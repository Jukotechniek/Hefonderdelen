import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || description.trim() === '') {
      return NextResponse.json(
        { error: 'Beschrijving is vereist' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey || apiKey === '') {
      return NextResponse.json(
        { error: 'Google AI API key niet geconfigureerd' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Transformeer de volgende ruwe productbeschrijving naar een professionele productomschrijving in het Nederlands. De beschrijving MOET altijd de volgende elementen bevatten:

1. Uitleggen wat het product is en waarvoor het wordt gebruikt (bijv. "is een essentieel onderdeel voor het optimaal functioneren van uw heftruck of magazijnwagen")
2. Kwaliteit, duurzaamheid en betrouwbaarheid benadrukken (bijv. "vervaardigd uit hoogwaardige materialen die zorgen voor duurzaamheid en betrouwbare prestaties, zelfs onder zware werkomstandigheden")
3. Voordelen beschrijven zoals eenvoudige montage en efficiëntie (bijv. "dankzij het precieze ontwerp en de perfecte pasvorm is dit onderdeel eenvoudig te monteren en draagt het bij aan een soepele en efficiënte werking")
4. Eindigen met een call-to-action over productiviteit (bijv. "Kies voor dit onderdeel om de productiviteit in uw magazijn te verhogen en ongewenste stilstand te voorkomen")

BELANGRIJK: Gebruik ALLEEN technische details (afmetingen, maten, specificaties zoals diameter, lengte, etc.) die expliciet in de ruwe beschrijving staan. Als er geen technische details in de ruwe beschrijving staan, voeg dan ook geen toe. Verzin GEEN extra gegevens, afmetingen of specificaties die niet in de ruwe beschrijving staan.

Ruwe beschrijving:
${description}

Schrijf alleen de verbeterde beschrijving in 2-3 korte alinea's (ongeveer 100 woorden totaal), zonder extra uitleg of inleiding.`,
    });

    const generatedText = response.text || "";
    
    if (!generatedText || generatedText.trim() === '') {
      return NextResponse.json(
        { error: 'AI heeft geen tekst gegenereerd' },
        { status: 500 }
      );
    }

    return NextResponse.json({ text: generatedText.trim() });
  } catch (error: any) {
    console.error('AI Generation failed', error);
    return NextResponse.json(
      { error: error.message || 'AI kon geen tekst genereren' },
      { status: 500 }
    );
  }
}
