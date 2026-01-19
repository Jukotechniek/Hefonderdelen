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
          content: `Transformeer de volgende ruwe productbeschrijving naar een professionele productomschrijving in het Nederlands. De beschrijving MOET altijd de volgende elementen bevatten:

1. Uitleggen wat het product is en waarvoor het wordt gebruikt (bijv. "is een essentieel onderdeel voor het optimaal functioneren van uw heftruck of magazijnwagen")
2. Kwaliteit, duurzaamheid en betrouwbaarheid benadrukken (bijv. "vervaardigd uit hoogwaardige materialen die zorgen voor duurzaamheid en betrouwbare prestaties, zelfs onder zware werkomstandigheden")
3. Voordelen beschrijven zoals eenvoudige montage en efficiëntie (bijv. "dankzij het precieze ontwerp en de perfecte pasvorm is dit onderdeel eenvoudig te monteren en draagt het bij aan een soepele en efficiënte werking")
4. Eindigen met een call-to-action over productiviteit (bijv. "Kies voor dit onderdeel om de productiviteit in uw magazijn te verhogen en ongewenste stilstand te voorkomen")

BELANGRIJK: Gebruik ALLEEN technische details (afmetingen, maten, specificaties zoals diameter, lengte, etc.) die expliciet in de ruwe beschrijving staan. Als er geen technische details in de ruwe beschrijving staan, voeg dan ook geen toe. Verzin GEEN extra gegevens, afmetingen of specificaties die niet in de ruwe beschrijving staan.

Ruwe beschrijving:
${description}

Schrijf alleen de verbeterde beschrijving in 2-3 korte alinea's (ongeveer 100 woorden totaal), zonder extra uitleg, inleiding of markdown. Alleen de omschrijving zelf.`
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
