import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, product_name } = body;

    const hasDescription = description && description.trim() !== '';
    const hasProductName = product_name && product_name.trim() !== '';

    if (!hasDescription && !hasProductName) {
      return NextResponse.json(
        { error: 'Product naam of beschrijving is vereist' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === '' || apiKey === 'sk-...') {
      console.error('OpenAI API key niet geconfigureerd');
      return NextResponse.json(
        { error: 'OpenAI API key niet geconfigureerd. Voeg OPENAI_API_KEY toe aan je .env bestand.' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ 
      apiKey: apiKey.trim(),
      timeout: 30000, // 30 seconden timeout
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        
        {
          role: 'system',
          content: `
        Je bent een technische productschrijver voor industriële onderdelen.
        
        JE TAAK:
        - Schrijf een korte productomschrijving in het Nederlands van 1 tot maximaal 2 zinnen.
        - Zin 1: wat het product is en waarvoor het wordt gebruikt (functie/toepassing).
        - Zin 2 (alleen indien relevant): noem extra technische info die letterlijk in de ruwe beschrijving staat (bijv. afmetingen, materiaal, aansluitingen, type/nummer, compatibiliteit, druk/temperatuur, etc.).
        
        HARD VERBOD:
        - Geen aannames of verzonnen info
        - Geen voordelen/marketing (geen “hoogwaardig”, “duurzaam”, “perfect”, “voorkom stilstand”, etc.)
        - Geen call-to-action
        - Geen opsommingen, geen kopjes, geen markdown
        - Geen derde zin
        
        REGEL:
        Gebruik UITSLUITEND informatie die expliciet in de ruwe beschrijving staat.
        Als er geen extra technische details staan, schrijf dan precies 1 zin.
        
        VOORBEELDEN:
        
        Input:
        Product: Gasveer
        Ruwe beschrijving:
        Een gasveer functioneert voor het open of omhoog houden van een deur of klep
        
        Output:
        Een gasveer functioneert voor het open of omhoog houden van een deur of klep.
        
        Input:
        Product: Hydrauliekslang
        Ruwe beschrijving:
        Een hydrauliekslang zorgt voor het transport van olie van punt A naar B
        
        Output:
        Een hydrauliekslang zorgt voor het transport van olie van punt A naar B.
        
        Input:
        Product: Hydrauliekslang
        Ruwe beschrijving:
        Hydrauliekslang voor olie, lengte 1 meter, aansluiting 3/8"
        
        Output:
        Deze hydrauliekslang is bedoeld voor het transport van olie. Lengte: 1 meter, aansluiting: 3/8".
        
        OUTPUT:
        Geef alleen de definitieve tekst (1–2 zinnen).
        `
        }
        
        ,
        {
          role: 'user',
          content: `
        ${hasProductName ? `Product: ${product_name}` : ''}
        ${hasProductName && hasDescription ? '\n' : ''}
        ${hasDescription ? `Ruwe beschrijving:\n${description}` : ''}
        `
        }
        
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    const generatedText = response.choices[0]?.message?.content || "";
    
    if (!generatedText || generatedText.trim() === '') {
      return NextResponse.json(
        { error: 'AI heeft geen tekst gegenereerd' },
        { status: 500 }
      );
    }

    return NextResponse.json({ text: generatedText.trim() });
  } catch (error: any) {
    console.error('AI Generation failed:', error);
    
    // Check voor specifieke OpenAI fouten
    if (error?.status === 401 || error?.response?.status === 401) {
      return NextResponse.json(
        { error: 'OpenAI API key is ongeldig. Controleer je OPENAI_API_KEY in het .env bestand.' },
        { status: 401 }
      );
    } else if (error?.status === 429 || error?.response?.status === 429) {
      return NextResponse.json(
        { error: 'Te veel verzoeken. Wacht even en probeer het opnieuw.' },
        { status: 429 }
      );
    } else if (error?.status === 500 || error?.response?.status === 500) {
      return NextResponse.json(
        { error: 'OpenAI service is tijdelijk niet beschikbaar. Probeer het later opnieuw.' },
        { status: 500 }
      );
    } else if (error?.code === 'ECONNREFUSED' || error?.message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'Geen internetverbinding of OpenAI service niet bereikbaar. Controleer je internetverbinding.' },
        { status: 503 }
      );
    }

    // Log de volledige error voor debugging
    const errorMessage = error?.message || error?.toString() || 'Onbekende fout';
    console.error('Full error details:', {
      message: errorMessage,
      status: error?.status,
      code: error?.code,
      type: error?.constructor?.name
    });

    return NextResponse.json(
      { error: `AI kon geen tekst genereren: ${errorMessage}` },
      { status: 500 }
    );
  }
}
