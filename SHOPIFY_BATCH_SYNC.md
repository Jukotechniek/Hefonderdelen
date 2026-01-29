# Shopify Batch Sync - Automatische Synchronisatie

De app slaat nu alleen foto's en beschrijvingen op in Supabase. De synchronisatie naar Shopify gebeurt automatisch via een periodieke batch job.

## Hoe het werkt

1. **App upload**: Gebruikers uploaden foto's en beschrijvingen → opgeslagen in Supabase
2. **Automatische sync**: Een batch job draait periodiek en synchroniseert producten die:
   - Meer dan 5 dagen geleden zijn geüpdatet (`updated_at`)
   - Een `shopify_description` hebben
   - Een `article_brand` hebben
   - Een `supplier` hebben
   - Foto's hebben in de Storage bucket

3. **Shopify sync**: Producten worden toegevoegd/bijgewerkt in Shopify als **concept (draft)**, niet direct actief

## Batch Sync Function

De Edge Function `shopify-batch-sync` is al gedeployed en kan worden aangeroepen om producten te synchroniseren.

### Handmatig aanroepen

Je kunt de function handmatig aanroepen via:

```bash
curl -X POST https://wrmmbgvxulhgqhupcvha.supabase.co/functions/v1/shopify-batch-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Of via de Supabase Dashboard:
1. Ga naar **Edge Functions**
2. Klik op `shopify-batch-sync`
3. Klik op **Invoke function**

### Automatisch schedulen

#### Optie 1: Supabase Cron Jobs (Aanbevolen)

**Methode A: Via Supabase Edge Function optie (Eenvoudigst)**

1. Ga naar je Supabase Dashboard
2. Ga naar **Database** → **Cron Jobs**
3. Klik op **New Cron Job**
4. Selecteer **"Supabase Edge Function"** als job type
5. Vul in:
   - **Name**: `shopify-batch-sync-daily`
   - **Schedule**: `0 2 * * *` (elke dag om 2:00 AM)
   - **Method**: `POST`
   - **Edge Function**: `shopify-batch-sync`
   - **Timeout**: `30000` (30 seconden, of hoger als je veel producten hebt)
   - **HTTP Headers**: 
     - `Content-Type`: `application/json`
     - **GEEN Authorization header nodig** - Supabase voegt dit automatisch toe!
   - **HTTP Request Body**: Leeg of `{}`

**Methode B: Via SQL snippet (Alternatief)**

1. Ga naar je Supabase Dashboard
2. Ga naar **Database** → **Cron Jobs**
3. Klik op **New Cron Job**
4. Selecteer **"SQL snippet"** als job type
5. Vul in:
   - **Name**: `shopify-batch-sync-daily`
   - **Schedule**: `0 2 * * *` (elke dag om 2:00 AM)
   - **Command**: 
     ```sql
     SELECT net.http_post(
       url:='https://wrmmbgvxulhgqhupcvha.supabase.co/functions/v1/shopify-batch-sync',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
       body:='{}'::jsonb
     );
     ```

**Belangrijk voor Methode B**: Vervang `YOUR_SERVICE_ROLE_KEY` met je echte Service Role Key (vind je in Project Settings → API)

**Troubleshooting**: Als de cron job niet start:
- Check of je **Methode A** gebruikt (Supabase Edge Function) - dit is het makkelijkst
- Check de logs in **Database** → **Cron Jobs** → klik op je cron job → **Logs** tab
- Test eerst handmatig via **Edge Functions** → `shopify-batch-sync` → **Test** button

#### Optie 2: Externe Cron Service

Je kunt ook een externe service gebruiken zoals:
- **GitHub Actions** (gratis voor publieke repos)
- **Cron-job.org** (gratis)
- **EasyCron** (gratis tier beschikbaar)

Stel een HTTP POST request in naar:
```
https://wrmmbgvxulhgqhupcvha.supabase.co/functions/v1/shopify-batch-sync
```

Met header:
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

#### Optie 3: pg_cron Extension

Als je pg_cron extension hebt geïnstalleerd:

```sql
-- Installeer pg_cron extension (als nog niet gedaan)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule de batch sync (elke dag om 2:00 AM)
SELECT cron.schedule(
  'shopify-batch-sync-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://wrmmbgvxulhgqhupcvha.supabase.co/functions/v1/shopify-batch-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

## Wat wordt gesynchroniseerd?

De batch sync synchroniseert producten die voldoen aan **alle** voorwaarden:

✅ `updated_at` > 5 dagen geleden  
✅ `shopify_description` is ingevuld  
✅ `article_brand` is ingevuld  
✅ `supplier` is ingevuld  
✅ Foto's aanwezig in Storage bucket (`tvh-{productId}/`)

## Limieten

- **Max 50 producten per run** (om Shopify rate limits te voorkomen)
- **500ms delay tussen producten** (rate limiting)
- Als er meer dan 50 producten zijn, worden ze in de volgende run gesynct

## Response Format

De function retourneert:

```json
{
  "success": true,
  "message": "Sync voltooid: 10 succesvol, 0 gefaald, 2 overgeslagen",
  "synced": 10,
  "failed": 0,
  "skipped": 2,
  "errors": []
}
```

## Troubleshooting

### Geen producten worden gesynct

1. Check of producten voldoen aan alle voorwaarden
2. Check of `updated_at` > 5 dagen geleden is
3. Check de logs in Supabase Dashboard → Edge Functions → Logs

### Rate Limit Errors

- De function heeft al rate limiting ingebouwd (500ms delay)
- Als je nog steeds rate limits krijgt, verhoog de delay of verlaag het aantal producten per run

### Foto's worden niet gevonden

- Check of foto's in de juiste bucket staan: `product-images/tvh-{productId}/`
- Check of de bucket publiek toegankelijk is of RLS policies correct zijn ingesteld

## Monitoring

Je kunt de sync status monitoren via:
- Supabase Dashboard → Edge Functions → Logs
- Database query:
  ```sql
  SELECT 
    article_number,
    updated_at,
    shopify_synced_at,
    shopify_product_id,
    CASE 
      WHEN shopify_synced_at IS NULL THEN 'Nog niet gesynct'
      WHEN shopify_synced_at < updated_at THEN 'Moet opnieuw gesynct worden'
      ELSE 'Gesynct'
    END as sync_status
  FROM products
  WHERE article_number LIKE 'TVH/%'
  ORDER BY updated_at DESC;
  ```
