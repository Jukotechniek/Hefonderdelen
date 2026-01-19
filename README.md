<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1qEl_Ecoen0qme3oe4ee9gdzk6eekdgcW

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Maak een `.env.local` bestand aan in de root directory met de volgende variabelen:
   ```env
   # Vereist: OpenAI API Key voor AI beschrijvingen
   VITE_OPENAI_API_KEY=sk-...

   # Optioneel: Supabase (voor auth en foto storage)
   # Als niet geconfigureerd, werkt de app in demo mode
   VITE_SUPABASE_URL=https://jouw-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...

   # Vereist: Shopify configuratie
   VITE_SHOPIFY_STORE_URL=https://jouw-winkel.myshopify.com
   VITE_SHOPIFY_ACCESS_TOKEN=shpat_...
   ```

3. Start de development server:
   ```bash
   npm run dev
   ```

   De app draait op http://localhost:3000

## Configuratie

### OpenAI API Key
- Ga naar https://platform.openai.com/api-keys
- Maak een nieuwe API key aan
- Voeg deze toe aan `.env.local` als `VITE_OPENAI_API_KEY`

### Supabase (Optioneel)
- Maak een account op https://supabase.com
- Maak een nieuw project aan
- Ga naar Settings > API en kopieer de URL en anon key
- Maak een Storage bucket aan genaamd `product-images` met publieke toegang

**Email verificatie uitschakelen (aanbevolen):**
1. Ga naar Authentication → Settings in je Supabase dashboard
2. Scroll naar "Email Auth"
3. Zet "Confirm email" UIT
4. Dit zorgt ervoor dat gebruikers direct kunnen inloggen na registratie zonder email verificatie

**Users uitnodigen via database:**
Je kunt gebruikers direct in de database aanmaken via het Supabase dashboard:
1. Ga naar Authentication → Users
2. Klik op "Add user" → "Create new user"
3. Vul email en wachtwoord in
4. De gebruiker kan direct inloggen met deze gegevens

### Shopify
- Ga naar je Shopify Admin
- Maak een Custom App aan met Admin API toegang
- Kopieer de Store URL en Access Token

**Edge Function is al aangemaakt!** De `shopify-proxy` Edge Function is al gedeployed.

**Stap 1: Stel Shopify secrets in in Supabase:**
1. Ga naar je Supabase Dashboard → Edge Functions → shopify-proxy
2. Klik op "Secrets" of gebruik de CLI:
   ```bash
   supabase secrets set SHOPIFY_STORE_URL=https://jouw-winkel.myshopify.com
   supabase secrets set SHOPIFY_ACCESS_TOKEN=shpat_...
   ```

**Stap 2: Voeg Edge Function URL toe aan `.env.local`:**
```env
VITE_SUPABASE_EDGE_FUNCTION_URL=https://jouw-project.supabase.co/functions/v1/shopify-proxy
```

Of laat dit leeg - de app gebruikt automatisch: `{VITE_SUPABASE_URL}/functions/v1/shopify-proxy`

**BELANGRIJK - CORS Probleem (OPGELOST):**
De Shopify Admin API blokkeert directe browser calls vanwege CORS. Je hebt een **Supabase Edge Function** nodig als proxy.

**Oplossing: Maak een Supabase Edge Function:**

1. Installeer Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref jouw-project-ref`
4. Maak Edge Function: `supabase functions new shopify-proxy`
5. Vervang de inhoud van `supabase/functions/shopify-proxy/index.ts` met:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { productId, imageUrls, description } = await req.json()
  const storeUrl = Deno.env.get('SHOPIFY_STORE_URL')
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

  if (!storeUrl || !accessToken) {
    return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), { status: 500 })
  }

  const sku = `tvh/${productId}`
  
  // Zoek product
  const searchRes = await fetch(`${storeUrl}/admin/api/2024-01/products.json?limit=250`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  })
  const searchData = await searchRes.json()
  let product = searchData.products?.find((p: any) => 
    p.variants?.some((v: any) => v.sku === sku)
  )

  // Maak product aan als het niet bestaat
  if (!product) {
    const createRes = await fetch(`${storeUrl}/admin/api/2024-01/products.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product: {
          title: `TVH ${productId}`,
          vendor: 'TVH',
          product_type: 'Onderdeel',
          variants: [{ sku, price: '0.00' }],
          body_html: description || ''
        }
      })
    })
    const createData = await createRes.json()
    product = createData.product
  }

  // Update beschrijving
  if (description && product.id) {
    await fetch(`${storeUrl}/admin/api/2024-01/products/${product.id}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ product: { id: product.id, body_html: description } })
    })
  }

  // Upload afbeeldingen
  if (imageUrls?.length > 0 && product.id) {
    for (const imageUrl of imageUrls) {
      await fetch(`${storeUrl}/admin/api/2024-01/products/${product.id}/images.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: { src: imageUrl, alt: `TVH ${productId}` } })
      })
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

6. Deploy: `supabase functions deploy shopify-proxy`
7. Voeg secrets toe: `supabase secrets set SHOPIFY_STORE_URL=... SHOPIFY_ACCESS_TOKEN=...`
8. Voeg toe aan `.env.local`: `VITE_SUPABASE_EDGE_FUNCTION_URL=https://jouw-project.supabase.co/functions/v1/shopify-proxy`

## Hoe het werkt

1. **Foto Upload**: Foto's worden eerst geüpload naar Supabase Storage (of direct naar Shopify als Supabase niet is geconfigureerd)
2. **AI Beschrijving**: Gebruik de "AI Hulp" knop om automatisch een productomschrijving te genereren met OpenAI
3. **Shopify Sync**: Producten worden automatisch aangemaakt of bijgewerkt op Shopify met de geüploade foto's en beschrijving
