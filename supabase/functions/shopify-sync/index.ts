import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ShopifyProduct {
  id?: number;
  title: string;
  body_html: string;
  vendor?: string;
  product_type?: string;
  status?: string; // 'active' of 'draft'
  variants: Array<{
    sku: string;
    price?: string;
    inventory_management?: string;
    inventory_policy?: string;
  }>;
  images?: Array<{
    src: string;
    alt?: string;
  }>;
}

interface RequestBody {
  productId: string;
  description: string;
  imageUrls: string[];
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
    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Geen authenticatie token' }),
        { 
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

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

    // Parse request body
    const body: RequestBody = await req.json();
    const { productId, description, imageUrls } = body;

    if (!productId || !description || !imageUrls || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'productId, description en imageUrls zijn verplicht' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const articleNumber = `TVH/${productId}`;
    const shopifyApiUrl = `https://${shopifyShop}/admin/api/2024-01/products.json`;

    // 0. Haal product data op uit Supabase en controleer verplichte velden
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('article_number, article_brand, supplier, product_name')
      .eq('article_number', articleNumber)
      .single();

    if (productError || !productData) {
      return new Response(
        JSON.stringify({ 
          error: 'Product niet gevonden in database',
          details: productError?.message || 'Product niet gevonden'
        }),
        { 
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Controleer of article_brand en supplier zijn ingevuld
    if (!productData.article_brand || productData.article_brand.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Product kan niet naar Shopify worden gesynchroniseerd',
          details: 'article_brand is niet ingevuld. Vul eerst het merk in voordat je naar Shopify synchroniseert.'
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (!productData.supplier || productData.supplier.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Product kan niet naar Shopify worden gesynchroniseerd',
          details: 'supplier is niet ingevuld. Vul eerst de leverancier in voordat je naar Shopify synchroniseert.'
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 1. Check of product al bestaat in Shopify via SKU
    // Gebruik GraphQL voor efficiëntere zoekopdracht
    let existingProductId: number | null = null;

    try {
      // Zoek via GraphQL Admin API (efficiënter dan REST)
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
        const products = graphqlData.data?.products?.edges || [];
        
        if (products.length > 0) {
          const product = products[0].node;
          // Check of SKU matcht
          const variant = product.variants?.edges?.[0]?.node;
          if (variant && variant.sku === articleNumber) {
            existingProductId = parseInt(product.legacyResourceId);
            console.log(`Product gevonden in Shopify: ${existingProductId}`);
          }
        }
      } else {
        // Fallback naar REST API als GraphQL faalt
        const searchUrl = `https://${shopifyShop}/admin/api/2024-01/products.json?limit=250`;
        const searchResponse = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const products = searchData.products || [];
          
          // Zoek product met matching SKU
          for (const product of products) {
            if (product.variants && product.variants.length > 0) {
              const variant = product.variants.find((v: any) => v.sku === articleNumber);
              if (variant) {
                existingProductId = product.id;
                console.log(`Product gevonden in Shopify (REST): ${existingProductId}`);
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('Fout bij zoeken naar product:', error);
      // Ga door, we proberen het product aan te maken
    }

    // 2. Verwerk images - Shopify accepteert externe URLs direct
    // We gebruiken de URLs direct, Shopify haalt ze zelf op
    const shopifyImages = imageUrls.map((url, index) => ({
      src: url,
      alt: `TVH ${productId} - Foto ${index + 1}`,
    }));

    // 3. Maak of update product in Shopify
    // Gebruik product_name uit database als titel, of fallback naar TVH {productId}
    const productTitle = productData.product_name || `TVH ${productId}`;
    
    const shopifyProductData: ShopifyProduct = {
      title: productTitle,
      body_html: description,
      vendor: productData.supplier || 'TVH',
      product_type: 'Heftruck onderdelen',
      status: 'draft', // Product als concept (draft) toevoegen, niet direct actief
      variants: [
        {
          sku: articleNumber,
          price: '0.00', // Prijs kan later worden ingesteld
          inventory_management: 'shopify',
          inventory_policy: 'deny',
        },
      ],
      images: shopifyImages,
    };

    let shopifyProductId: number;
    let shopifyResponse;

    if (existingProductId) {
      // Update bestaand product
      const updateUrl = `https://${shopifyShop}/admin/api/2024-01/products/${existingProductId}.json`;
      
      shopifyResponse = await fetch(updateUrl, {
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

      if (!shopifyResponse.ok) {
        const errorText = await shopifyResponse.text();
        throw new Error(`Shopify update fout: ${shopifyResponse.status} - ${errorText}`);
      }

      shopifyProductId = existingProductId;
      console.log(`Product bijgewerkt in Shopify: ${shopifyProductId}`);
    } else {
      // Maak nieuw product
      shopifyResponse = await fetch(shopifyApiUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product: shopifyProductData }),
      });

      if (!shopifyResponse.ok) {
        const errorText = await shopifyResponse.text();
        throw new Error(`Shopify create fout: ${shopifyResponse.status} - ${errorText}`);
      }

      const responseData = await shopifyResponse.json();
      shopifyProductId = responseData.product.id;
      console.log(`Nieuw product aangemaakt in Shopify: ${shopifyProductId}`);
    }

    // 4. Update Supabase database met Shopify product ID
    const { error: dbError } = await supabase
      .from('products')
      .update({
        shopify_product_id: shopifyProductId.toString(), // Convert to string since column is text
        shopify_synced_at: new Date().toISOString(),
      })
      .eq('article_number', articleNumber);

    if (dbError) {
      console.warn('Fout bij updaten van database:', dbError);
      // Dit is niet kritiek, product is al in Shopify
    }

    return new Response(
      JSON.stringify({
        success: true,
        shopifyProductId,
        message: existingProductId ? 'Product bijgewerkt in Shopify' : 'Product toegevoegd aan Shopify',
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
    console.error('Shopify sync fout:', error);
    return new Response(
      JSON.stringify({
        error: 'Fout bij synchroniseren met Shopify',
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
