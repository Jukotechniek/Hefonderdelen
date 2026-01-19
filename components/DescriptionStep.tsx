
import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, Loader2, AlignLeft } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface DescriptionStepProps {
  productId: string;
  value: string;
  onChange: (val: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const DescriptionStep: React.FC<DescriptionStepProps> = ({ productId, value, onChange, onNext, onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAiHelp = async () => {
    if (!value || value.trim() === '') {
      alert("Voer eerst een beschrijving in voordat je AI hulp gebruikt.");
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Transformeer de volgende ruwe productbeschrijving naar een professionele productomschrijving in het Nederlands. De beschrijving MOET altijd de volgende elementen bevatten:

1. Uitleggen wat het product is en waarvoor het wordt gebruikt (bijv. "is een essentieel onderdeel voor het optimaal functioneren van uw heftruck of magazijnwagen")
2. Kwaliteit, duurzaamheid en betrouwbaarheid benadrukken (bijv. "vervaardigd uit hoogwaardige materialen die zorgen voor duurzaamheid en betrouwbare prestaties, zelfs onder zware werkomstandigheden")
3. Voordelen beschrijven zoals eenvoudige montage en efficiëntie (bijv. "dankzij het precieze ontwerp en de perfecte pasvorm is dit onderdeel eenvoudig te monteren en draagt het bij aan een soepele en efficiënte werking")
4. Eindigen met een call-to-action over productiviteit (bijv. "Kies voor dit onderdeel om de productiviteit in uw magazijn te verhogen en ongewenste stilstand te voorkomen")

BELANGRIJK: Gebruik ALLEEN technische details (afmetingen, maten, specificaties zoals diameter, lengte, etc.) die expliciet in de ruwe beschrijving staan. Als er geen technische details in de ruwe beschrijving staan, voeg dan ook geen toe. Verzin GEEN extra gegevens, afmetingen of specificaties die niet in de ruwe beschrijving staan.

Ruwe beschrijving:
${value}

Schrijf alleen de verbeterde beschrijving in 2-3 korte alinea's (ongeveer 100 woorden totaal), zonder extra uitleg of inleiding.`,
      });
      
      const generatedText = response.text || "";
      onChange(generatedText.trim());
    } catch (error) {
      console.error("AI Generation failed", error);
      alert("AI kon geen tekst genereren. Probeer het later opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
          <AlignLeft size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Product Omschrijving</h2>
        <p className="text-slate-500 mt-1 text-sm">Product: <span className="font-semibold text-slate-700">tvh/{productId}</span></p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-40 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none resize-none"
            placeholder="Voer hier de omschrijving in..."
          />
          <button
            onClick={handleAiHelp}
            disabled={isGenerating}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Sparkles size={14} />
            )}
            AI Hulp
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onBack}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <ArrowLeft size={20} />
            Terug
          </button>
          <button
            onClick={onNext}
            className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100"
          >
            Foto's Uploaden
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DescriptionStep;
