# Shopify Integratie Setup

Deze applicatie slaat foto's en beschrijvingen op in Supabase. Producten worden automatisch naar Shopify gesynchroniseerd via een periodieke batch job (elke dag voor producten die > 5 dagen geleden zijn geüpdatet).

**Zie [SHOPIFY_BATCH_SYNC.md](./SHOPIFY_BATCH_SYNC.md) voor details over de automatische synchronisatie.**

## Vereisten

1. **Shopify Store** - Je hebt een Shopify store nodig
2. **Shopify Admin API Access Token** - Voor toegang tot de Admin API

## Configuratie

### 1. Shopify Admin API Access Token aanmaken

1. Ga naar je Shopify Admin Dashboard
2. Ga naar **Settings** → **Apps and sales channels** → **Develop apps**
3. Klik op **Create an app**
4. Geef je app een naam (bijv. "Product Sync")
5. Klik op **Create app**
6. Ga naar **API scopes** en selecteer de volgende permissions:
   - `write_products` - Voor het aanmaken/bijwerken van producten
   - `read_products` - Voor het zoeken naar bestaande producten
7. Klik op **Save**
8. Ga naar **API credentials** tab
9. Klik op **Install app** en bevestig
10. Kopieer de **Admin API access token**

### 2. Supabase Environment Variables instellen

Voeg de volgende environment variables toe aan je Supabase project:

1. Ga naar je Supabase Dashboard
2. Ga naar **Project Settings** → **Edge Functions** → **Secrets**
3. Voeg de volgende secrets toe:

```
SHOPIFY_SHOP=je-winkelnaam.myshopify.com
SHOPIFY_ACCESS_TOKEN=jouw-admin-api-access-token
```

**Belangrijk:**
- `SHOPIFY_SHOP` moet alleen de shop naam zijn (zonder `https://`)
- Bijvoorbeeld: als je shop URL `https://mijnwinkel.myshopify.com` is, gebruik dan `mijnwinkel.myshopify.com`

### 3. Edge Function deployen

Deploy de Edge Function naar Supabase:

```bash
# Installeer Supabase CLI als je die nog niet hebt
npm install -g supabase

# Login bij Supabase
supabase login

# Link naar je project
supabase link --project-ref je-project-ref

# Deploy de function
supabase functions deploy shopify-sync
```

Of gebruik de Supabase Dashboard:
1. Ga naar **Edge Functions** in je Supabase Dashboard
2. Upload de `supabase/functions/shopify-sync` directory
3. Zorg dat de secrets zijn ingesteld (zie stap 2)

## Hoe het werkt

1. **Product opslaan**: Wanneer een gebruiker foto's en een beschrijving opslaat:
   - Foto's worden opgeslagen in Supabase Storage
   - Beschrijving wordt opgeslagen in de `products` tabel
   - De Edge Function wordt automatisch aangeroepen

2. **Shopify Sync**: De Edge Function:
   - Zoekt of het product al bestaat in Shopify (via SKU: `TVH/{productId}`)
   - Maakt een nieuw product aan of werkt het bestaande product bij
   - Upload de foto's naar Shopify
   - Stelt de beschrijving in
   - Slaat de Shopify product ID op in de database

3. **Product structuur in Shopify**:
   - **Titel**: `TVH {productId}`
   - **SKU**: `TVH/{productId}` (dit is het artikelnummer)
   - **Vendor**: TVH
   - **Product Type**: Heftruck onderdelen
   - **Beschrijving**: De gegenereerde/ingevoerde beschrijving
   - **Foto's**: Alle geüploade foto's

## Database Schema

De `products` tabel moet de volgende velden hebben:
- `article_number` (text) - Het TVH nummer (formaat: `TVH/{productId}`)
- `product_name` (text) - Product naam
- `shopify_description` (text) - De beschrijving voor Shopify
- `shopify_product_id` (bigint, nullable) - Het Shopify product ID na sync
- `shopify_synced_at` (timestamp, nullable) - Wanneer het laatste sync is gedaan

## Troubleshooting

### "Shopify credentials niet geconfigureerd"
- Controleer of de secrets correct zijn ingesteld in Supabase
- Zorg dat `SHOPIFY_SHOP` geen `https://` bevat
- Zorg dat `SHOPIFY_ACCESS_TOKEN` correct is gekopieerd

### "Shopify sync fout"
- Controleer de Edge Function logs in Supabase Dashboard
- Zorg dat de API scopes correct zijn ingesteld
- Controleer of je shop URL correct is

### Product wordt niet gevonden maar bestaat wel
- De SKU moet exact `TVH/{productId}` zijn
- Controleer of het product in Shopify de juiste SKU heeft

## Veiligheid

- **API credentials blijven op de server**: De Shopify access token wordt alleen gebruikt in de Edge Function, nooit in de client
- **JWT verificatie**: De Edge Function vereist een geldige Supabase JWT token
- **Rate limiting**: Shopify heeft rate limits, de Edge Function respecteert deze automatisch
