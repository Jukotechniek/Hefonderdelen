import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body;

    if (!description || description.trim() === '') {
      return NextResponse.json(
        { error: 'Beschrijving is vereist' },
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
          content: 'Je bent een technische schrijver die ruwe productbeschrijvingen transformeert naar professionele productomschrijvingen in het Nederlands voor heftruck- en magazijnwagen onderdelen. Je schrijft in een specifieke stijl die altijd de volgende elementen bevat: 1) Wat het product is en waarvoor het wordt gebruikt, 2) Kwaliteit, duurzaamheid en betrouwbaarheid benadrukken, 3) Voordelen zoals eenvoudige montage en efficiëntie beschrijven, 4) Eindigen met een call-to-action over productiviteit. BELANGRIJK: Gebruik ALLEEN technische details die expliciet in de ruwe beschrijving staan. Verzin GEEN extra afmetingen, maten of specificaties.'
        },
        {
          role: 'user',
          content: `Schrijf een professionele productbeschrijving in het Nederlands voor een heftruckonderdeel. Volg deze structuur:

1. **Functie en toepassing**: Leg uit wat het product is en waarvoor het dient (bijvoorbeeld: "Dit onderdeel is essentieel voor het optimaal functioneren van uw heftruck of magazijnwagen")

2. **Kwaliteit en betrouwbaarheid**: Benadruk de hoogwaardige materialen, duurzaamheid en betrouwbare prestaties, ook onder zware werkomstandigheden

3. **Praktische voordelen**: Beschrijf voordelen zoals eenvoudige montage, perfecte pasvorm en bijdrage aan soepele werking

4. **Call-to-action**: Sluit af met een oproep gericht op verhoogde productiviteit en het voorkomen van stilstand

CRUCIALE REGEL: Gebruik UITSLUITEND technische specificaties (afmetingen, diameter, lengte, gewicht, etc.) die letterlijk in onderstaande ruwe beschrijving staan. Verzin NOOIT extra gegevens of specificaties die niet expliciet vermeld worden.

Ruwe beschrijving:
${description}

Schrijf een compacte beschrijving van 2-3 korte alinea's (circa 100 woorden totaal). Geef alleen de definitieve productomschrijving, zonder inleiding, uitleg of opmaak.`
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
