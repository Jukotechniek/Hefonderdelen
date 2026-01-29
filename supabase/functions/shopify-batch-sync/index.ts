import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ShopifyProduct {
  id?: number;
  title: string;
  body_html: string;
  vendor?: string;
  product_type?: string;
  status?: string;
  variants: Array<{
    sku: string;
    price?: string;
    cost?: string;
    inventory_management?: string;
    inventory_policy?: string;
  }>;
  images?: Array<{
    src: string;
    alt?: string;
  }>;
}

Deno.serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get environment variables
    const shopifyShop = Deno.env.get('SHOPIFY_SHOP');
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!shopifyShop || !shopifyAccessToken) {
      console.error('Shopify credentials niet geconfigureerd');
      return new Response(
        JSON.stringify({ error: 'Shopify credentials niet geconfigureerd' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials niet geconfigureerd');
      return new Response(
        JSON.stringify({ error: 'Supabase credentials niet geconfigureerd' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Haal producten op die nog niet gesynct zijn OF waar de sync ouder is dan de update
    // EN die > 5 dagen geleden zijn geüpdatet (om niet te vaak te syncen)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoISO = fiveDaysAgo.toISOString();

    // Query: producten die:
    // 1. Alle verplichte velden hebben
    // 2. EN (shopify_synced_at IS NULL OF shopify_synced_at < updated_at)
    // 3. EN updated_at > 5 dagen geleden (om niet te vaak te syncen)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, article_number, article_brand, supplier, product_name, shopify_description, updated_at, shopify_product_id, shopify_synced_at, purchase_price, specs')
      .like('article_number', 'TVH/%') // Filter op TVH producten
      .not('shopify_description', 'is', null) // Moet beschrijving hebben
      .neq('shopify_description', '') // Beschrijving mag niet leeg zijn
      .not('article_brand', 'is', null) // Moet merk hebben
      .neq('article_brand', '') // Merk mag niet leeg zijn
      .not('supplier', 'is', null) // Moet leverancier hebben
      .neq('supplier', '') // Leverancier mag niet leeg zijn
      .not('purchase_price', 'is', null) // Moet inkoop prijs hebben
      .limit(100); // Verhoog limit om meer producten te vinden

    if (productsError) {
      throw new Error(`Fout bij ophalen producten: ${productsError.message}`);
    }

    // Filter in code:
    // 1. Producten die NOG NIET gesynct zijn (shopify_synced_at IS NULL): altijd syncen
    // 2. Producten die al gesynct zijn maar opnieuw moeten: alleen als updated_at > 5 dagen geleden
    const filteredProducts = products?.filter(product => {
      const updatedAt = new Date(product.updated_at);
      const fiveDaysAgoDate = new Date(fiveDaysAgoISO);
      
      // Als nog niet gesynct: altijd syncen (ongeacht updated_at)
      if (!product.shopify_synced_at) {
        return true;
      }
      
      // Als al gesynct: check of sync ouder is dan update EN update > 5 dagen geleden
      const syncedAt = new Date(product.shopify_synced_at);
      const needsResync = syncedAt < updatedAt;
      
      if (!needsResync) {
        return false; // Al gesynct en up-to-date
      }
      
      // Alleen resyncen als update > 5 dagen geleden (om niet te vaak te syncen)
      return updatedAt <= fiveDaysAgoDate;
    }) || [];

    if (productsError) {
      throw new Error(`Fout bij ophalen producten: ${productsError.message}`);
    }

    if (!filteredProducts || filteredProducts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Geen producten gevonden die gesynct moeten worden',
          synced: 0,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`Gevonden ${filteredProducts.length} producten om te synchroniseren (van ${products?.length || 0} producten met alle verplichte velden)`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Sync elk product
    for (const product of filteredProducts) {
      try {
        const productId = product.article_number.replace('TVH/', '');
        const articleNumber = product.article_number;

        // Validatie: Check of alle verplichte velden aanwezig zijn
        if (!product.purchase_price || product.purchase_price === null) {
          console.log(`Geen inkoop prijs voor ${articleNumber}, skip`);
          results.skipped++;
          continue;
        }

        // Check specs velden - gebruik machines data als fallback
        const specs = product.specs || {};
        
        // Haal machines data op via product_machine
        let machineBrand = '';
        let machineModel = '';
        let machineYear = '';
        
        // Eerst product_machine ophalen
        const { data: productMachine, error: pmError } = await supabase
          .from('product_machine')
          .select('machine_id')
          .eq('product_id', product.id)
          .limit(1)
          .maybeSingle();
        
        if (!pmError && productMachine && productMachine.machine_id) {
          // Haal machine details op
          const { data: machineDetails, error: machineError } = await supabase
            .from('machines')
            .select('brand, model, build_years')
            .eq('id', productMachine.machine_id)
            .maybeSingle();
          
          if (!machineError && machineDetails) {
            machineBrand = machineDetails.brand || '';
            machineModel = machineDetails.model || '';
            // build_years is een array, neem het eerste jaar
            if (machineDetails.build_years && Array.isArray(machineDetails.build_years) && machineDetails.build_years.length > 0) {
              machineYear = machineDetails.build_years[0].toString();
            }
          }
        }
        
        // Gebruik fallbacks: specs -> machines -> article_brand (voor brand)
        const brand = specs.brand || machineBrand || product.article_brand || '';
        const type = specs.type || machineModel || '';
        const year = specs.year || machineYear || '';
        
        if (!brand || brand === '') {
          console.log(`Geen brand (specs.brand, machines.brand of article_brand) voor ${articleNumber}, skip`);
          results.skipped++;
          continue;
        }
        if (!type || type === '') {
          console.log(`Geen type (specs.type of machines.model) voor ${articleNumber}, skip`);
          results.skipped++;
          continue;
        }
        if (!year || year === '') {
          console.log(`Geen year (specs.year of machines.build_years) voor ${articleNumber}, skip`);
          results.skipped++;
          continue;
        }

        // Check of er foto's zijn in de bucket
        const folderPath = `tvh-${productId}/`;
        const { data: files, error: filesError } = await supabase.storage
          .from('product-images')
          .list(folderPath, {
            limit: 100,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (filesError || !files || files.length === 0) {
          console.log(`Geen foto's gevonden voor ${articleNumber}, skip`);
          results.skipped++;
          continue;
        }

        // Haal publieke URLs op voor alle foto's
        const imageUrls: string[] = [];
        for (const file of files) {
          if (file.name && (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png'))) {
            const filePath = `${folderPath}${file.name}`;
            const { data: urlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);
            if (urlData?.publicUrl) {
              imageUrls.push(urlData.publicUrl);
            }
          }
        }

        if (imageUrls.length === 0) {
          console.log(`Geen geldige foto URLs voor ${articleNumber}, skip`);
          results.skipped++;
          continue;
        }

        // Check of product al bestaat in Shopify
        let existingProductId: number | null = product.shopify_product_id ? parseInt(product.shopify_product_id) : null;

        // Als we geen shopify_product_id hebben, zoek het product
        if (!existingProductId) {
          try {
            const graphqlUrl = `https://${shopifyShop}/admin/api/2024-01/graphql.json`;
            const searchQuery = {
              query: `
                query getProductBySku {
                  products(first: 1, query: "sku:${articleNumber}") {
                    edges {
                      node {
                        id
                        legacyResourceId
                        variants(first: 1) {
                          edges {
                            node {
                              sku
                            }
                          }
                        }
                      }
                    }
                  }
                }
              `,
            };

            const graphqlResponse = await fetch(graphqlUrl, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': shopifyAccessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(searchQuery),
            });

            if (graphqlResponse.ok) {
              const graphqlData = await graphqlResponse.json();
              const shopifyProducts = graphqlData.data?.products?.edges || [];
              
              if (shopifyProducts.length > 0) {
                const shopifyProduct = shopifyProducts[0].node;
                const variant = shopifyProduct.variants?.edges?.[0]?.node;
                if (variant && variant.sku === articleNumber) {
                  existingProductId = parseInt(shopifyProduct.legacyResourceId);
                }
              }
            }
          } catch (error) {
            console.warn(`Fout bij zoeken naar product ${articleNumber}:`, error);
          }
        }

        // Verwerk images
        const shopifyImages = imageUrls.map((url, index) => ({
          src: url,
          alt: `${product.product_name || articleNumber} - Foto ${index + 1}`,
        }));

        // Maak product data
        const productTitle = product.product_name || `TVH ${productId}`;
        const purchasePrice = product.purchase_price || '0.00';
        const shopifyProductData: ShopifyProduct = {
          title: productTitle,
          body_html: product.shopify_description || '',
          vendor: product.supplier || 'TVH',
          product_type: 'Heftruck onderdelen',
          status: 'draft', // Als concept toevoegen
          variants: [
            {
              sku: articleNumber,
              price: '0.00',
              cost: purchasePrice.toString(), // Inkoop prijs op variant
              inventory_management: 'shopify',
              inventory_policy: 'deny',
            },
          ],
          images: shopifyImages,
        };

        let shopifyProductId: number;

        if (existingProductId) {
          // Update bestaand product
          const updateUrl = `https://${shopifyShop}/admin/api/2024-01/products/${existingProductId}.json`;
          
          const updateResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
              'X-Shopify-Access-Token': shopifyAccessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              product: {
                ...shopifyProductData,
                id: existingProductId,
              },
            }),
          });

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Shopify update fout: ${updateResponse.status} - ${errorText}`);
          }

          shopifyProductId = existingProductId;
          console.log(`Product bijgewerkt in Shopify: ${articleNumber} -> ${shopifyProductId}`);
          
          // Update ook de variant cost price als het product al bestaat
          // Haal eerst de variant ID op
          const productDetailsUrl = `https://${shopifyShop}/admin/api/2024-01/products/${existingProductId}.json`;
          const productDetailsResponse = await fetch(productDetailsUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': shopifyAccessToken,
              'Content-Type': 'application/json',
            },
          });
          
          if (productDetailsResponse.ok) {
            const productDetails = await productDetailsResponse.json();
            const variant = productDetails.product?.variants?.[0];
            if (variant && variant.id) {
              // Update variant met cost price
              const variantUpdateUrl = `https://${shopifyShop}/admin/api/2024-01/variants/${variant.id}.json`;
              await fetch(variantUpdateUrl, {
                method: 'PUT',
                headers: {
                  'X-Shopify-Access-Token': shopifyAccessToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  variant: {
                    id: variant.id,
                    cost: purchasePrice.toString(),
                  },
                }),
              });
            }
          }
        } else {
          // Maak nieuw product
          const createUrl = `https://${shopifyShop}/admin/api/2024-01/products.json`;
          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': shopifyAccessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ product: shopifyProductData }),
          });

          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Shopify create fout: ${createResponse.status} - ${errorText}`);
          }

          const responseData = await createResponse.json();
          shopifyProductId = responseData.product.id;
          console.log(`Nieuw product aangemaakt in Shopify: ${articleNumber} -> ${shopifyProductId}`);
        }

        // Voeg metafields toe aan het product
        // specs.machine standaard op "heftruck" als niet ingevuld
        // brand is al gedefinieerd boven (met fallback naar article_brand)
        const machine = specs.machine || 'heftruck';
        // type en year zijn al gedefinieerd boven

        const metafields = [
          {
            namespace: 'custom',
            key: 'brand',
            value: brand,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'type',
            value: type,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'machine',
            value: machine,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'year',
            value: year.toString(),
            type: 'single_line_text_field',
          },
        ];

        // Update metafields via GraphQL (efficiënter dan REST)
        const metafieldsUrl = `https://${shopifyShop}/admin/api/2024-01/graphql.json`;
        for (const metafield of metafields) {
          try {
            const metafieldMutation = {
              query: `
                mutation productUpdateMetafield($productId: ID!, $namespace: String!, $key: String!, $value: String!, $type: String!) {
                  productUpdateMetafield(
                    productId: $productId
                    namespace: $namespace
                    key: $key
                    value: $value
                    type: $type
                  ) {
                    metafield {
                      id
                      namespace
                      key
                      value
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `,
              variables: {
                productId: `gid://shopify/Product/${shopifyProductId}`,
                namespace: metafield.namespace,
                key: metafield.key,
                value: metafield.value,
                type: metafield.type,
              },
            };

            const metafieldResponse = await fetch(metafieldsUrl, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': shopifyAccessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(metafieldMutation),
            });

            if (metafieldResponse.ok) {
              const metafieldData = await metafieldResponse.json();
              if (metafieldData.data?.productUpdateMetafield?.userErrors?.length > 0) {
                console.warn(`Metafield fout voor ${metafield.key}:`, metafieldData.data.productUpdateMetafield.userErrors);
              }
            }
          } catch (error) {
            console.warn(`Fout bij toevoegen metafield ${metafield.key}:`, error);
            // Ga door, metafields zijn niet kritiek
          }
        }

        // Update database
        const { error: dbError } = await supabase
          .from('products')
          .update({
            shopify_product_id: shopifyProductId.toString(),
            shopify_synced_at: new Date().toISOString(),
          })
          .eq('article_number', articleNumber);

        if (dbError) {
          console.warn(`Fout bij updaten database voor ${articleNumber}:`, dbError);
        }

        results.success++;
        
        // Kleine delay om rate limits te voorkomen
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`Fout bij sync van ${product.article_number}:`, error);
        results.failed++;
        results.errors.push(`${product.article_number}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync voltooid: ${results.success} succesvol, ${results.failed} gefaald, ${results.skipped} overgeslagen`,
        synced: results.success,
        failed: results.failed,
        skipped: results.skipped,
        errors: results.errors,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Batch sync fout:', error);
    return new Response(
      JSON.stringify({
        error: 'Fout bij batch synchroniseren met Shopify',
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
