
import React, { useRef, useState } from 'react';
import { 
  Upload, 
  Camera, 
  ImagePlus, 
  Loader2, 
  Save, 
  Trash2, 
  ArrowLeft, 
  Sparkles, 
  AlignLeft, 
  ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { UploadedFile } from '../types';
import { supabase } from '../supabaseClient';

interface UploadStepProps {
  productId: string;
  description: string;
  onDescriptionChange: (val: string) => void;
  images: UploadedFile[];
  onImagesChange: (images: UploadedFile[]) => void;
  onBack: () => void;
  onSuccess: () => void;
}

const UploadStep: React.FC<UploadStepProps> = ({ 
  productId, 
  description, 
  onDescriptionChange, 
  images, 
  onImagesChange, 
  onBack,
  onSuccess 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAiHelp = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const apiKey = (import.meta.env?.VITE_OPENAI_API_KEY as string) || (process.env?.OPENAI_API_KEY as string);
      
      if (!apiKey || apiKey === '' || apiKey === 'sk-...') {
        setError('⚠️ OpenAI API key niet geconfigureerd. Voeg VITE_OPENAI_API_KEY toe aan je .env bestand.');
        setIsGenerating(false);
        return;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Je bent een technische schrijver die korte, krachtige productomschrijvingen schrijft in het Nederlands.'
            },
            {
              role: 'user',
              content: `Schrijf een zeer korte, krachtige en professionele technische productomschrijving in het Nederlands voor een onderdeel met ID tvh/${productId}. Focus op kwaliteit en industrieel gebruik. Geen markdown, geen inleiding, alleen de omschrijving zelf.`
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || 'Onbekende fout';
        
        if (response.status === 401) {
          setError('❌ OpenAI API key is ongeldig. Controleer je VITE_OPENAI_API_KEY in het .env bestand.');
        } else if (response.status === 429) {
          setError('⏱️ Te veel verzoeken. Wacht even en probeer het opnieuw.');
        } else if (response.status === 500 || response.status >= 502) {
          setError('🔧 OpenAI service is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
        } else {
          setError(`❌ AI fout: ${errorMessage}. Probeer het handmatig of controleer je API key.`);
        }
        setIsGenerating(false);
        return;
      }

      const data = await response.json();
      const generatedText = data.choices[0]?.message?.content || "";
      
      if (!generatedText || generatedText.trim() === '') {
        setError('⚠️ AI heeft geen tekst gegenereerd. Probeer het opnieuw of schrijf handmatig.');
        setIsGenerating(false);
        return;
      }
      
      onDescriptionChange(generatedText.trim());
      setError(null); // Clear any previous errors on success
    } catch (err: any) {
      console.error("AI Generation failed", err);
      
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        setError('🌐 Geen internetverbinding of OpenAI service niet bereikbaar. Controleer je internetverbinding.');
      } else if (err.message?.includes('API key')) {
        setError('🔑 OpenAI API key probleem. Controleer je VITE_OPENAI_API_KEY in het .env bestand.');
      } else {
        setError(`❌ AI kon geen tekst genereren: ${err.message || 'Onbekende fout'}. Probeer het handmatig.`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file: File) => ({
        file,
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substr(2, 9)
      }));
      onImagesChange([...images, ...newFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    const imgToRemove = images.find(img => img.id === id);
    if (imgToRemove) URL.revokeObjectURL(imgToRemove.preview);
    onImagesChange(images.filter(img => img.id !== id));
  };

  const handleSave = async () => {
    if (images.length === 0 && !description.trim()) {
      setError("Voeg minimaal foto's of een omschrijving toe.");
      return;
    }
    setIsUploading(true);
    setError(null);
    
    // Declareer uploadedUrls buiten try block zodat het beschikbaar is in catch
    const uploadedUrls: string[] = [];
    
    try {
      // Eerst uploaden naar Supabase Storage
      
      if (images.length > 0) {
        // Check of Supabase Storage is geconfigureerd
        const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string) || '';
        const hasSupabase = supabaseUrl && supabaseUrl !== '' && supabaseUrl !== 'https://placeholder.supabase.co';
        
        if (hasSupabase) {
          // Probeer te uploaden naar Supabase Storage
          for (const img of images) {
            let fileName = '';
            let uploadSuccess = false;
            
            try {
              // Upload naar tvh{productId}/ met bestandsnamen {productId}-1.jpg, {productId}-2.jpg, etc.
              const fileExt = img.file.name.split('.').pop() || 'jpg';
              const imageNumber = images.indexOf(img) + 1;
              fileName = `tvh-${productId}/tvh-${productId}-${imageNumber}.${fileExt}`;
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, img.file, {
                  cacheControl: '3600',
                  upsert: true // Overschrijf als bestand al bestaat
                });

              if (uploadError) {
                console.error('Upload error:', uploadError);
                
                // Specifieke foutmeldingen
                if (uploadError.message?.includes('Bucket') || uploadError.message?.includes('not found')) {
                  throw new Error(`Supabase Storage bucket 'product-images' bestaat niet. Maak deze aan in je Supabase dashboard (Storage → Create bucket).`);
                } else if (uploadError.message?.includes('JWT') || uploadError.message?.includes('auth')) {
                  throw new Error(`Supabase authenticatie fout. Controleer je VITE_SUPABASE_ANON_KEY in je .env bestand.`);
                } else if (uploadError.message?.includes('new row violates') || uploadError.message?.includes('policy')) {
                  throw new Error(`Supabase Storage policy fout. Zorg dat de bucket 'product-images' publieke toegang heeft of dat je RLS policies correct zijn ingesteld.`);
                } else {
                  throw new Error(`Foto upload mislukt: ${uploadError.message || 'Onbekende fout'}`);
                }
              }

              uploadSuccess = true;

              // Haal publieke URL op
              const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);

              // getPublicUrl geeft altijd een object terug, check of de URL geldig is
              const publicUrl = urlData?.publicUrl || '';
              if (publicUrl && publicUrl.length > 0) {
                uploadedUrls.push(publicUrl);
                console.log(`Foto geüpload: ${fileName} -> ${publicUrl}`);
              } else {
                // Als er geen publieke URL is, gebruik de path om een URL te construeren
                const constructedUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fileName}`;
                uploadedUrls.push(constructedUrl);
                console.log(`Gebruik geconstrueerde URL: ${constructedUrl}`);
              }
            } catch (imgError: any) {
              // Log de fout maar gooi alleen door als het echt een kritieke fout is
              console.error(`Fout bij uploaden van ${img.file.name}:`, imgError);
              // Als de upload succesvol was maar alleen de URL ophalen faalde, probeer door te gaan
              if (uploadSuccess && imgError.message?.includes('publieke URL') && fileName) {
                // Upload was succesvol, gebruik geconstrueerde URL
                const constructedUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fileName}`;
                uploadedUrls.push(constructedUrl);
                console.warn(`Gebruik geconstrueerde URL als fallback: ${constructedUrl}`);
              } else {
                throw new Error(`Fout bij uploaden van ${img.file.name}: ${imgError.message}`);
              }
            }
          }
        } else {
          // Als Supabase niet is geconfigureerd, gebruik base64 of data URLs (tijdelijk)
          // Dit is niet ideaal maar werkt als fallback
          throw new Error('Supabase Storage is niet geconfigureerd. Configureer VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in je .env bestand en maak een bucket genaamd "product-images" aan.');
        }
      }

      // Alles is opgeslagen in Supabase Storage
      if (uploadedUrls.length > 0 || images.length === 0) {
        onSuccess();
      } else {
        throw new Error('Geen foto\'s geüpload');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      
      // Betere error messages met meer details
      let errorMessage = err.message || 'Er is iets fout gegaan bij het opslaan.';
      
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.name === 'TypeError') {
        if (err.message?.includes('Supabase') || err.stack?.includes('supabase')) {
          errorMessage = 'Supabase Storage fout: Controleer of de bucket "product-images" bestaat en of je Supabase credentials correct zijn.';
        } else {
          errorMessage = 'Netwerkfout: Controleer je internetverbinding. Als het probleem aanhoudt, controleer de browser console (F12) voor meer details.';
        }
      } else if (err.message?.includes('bucket') || err.message?.includes('Bucket')) {
        errorMessage = err.message; // Gebruik de specifieke bucket foutmelding
      } else if (err.message?.includes('authenticatie') || err.message?.includes('auth') || err.message?.includes('JWT')) {
        errorMessage = err.message; // Gebruik de specifieke auth foutmelding
      }
      
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-8">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 sm:p-8 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <div>
            <button 
              onClick={onBack}
              className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 text-sm font-semibold mb-2 transition-colors group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              Nieuw ID invoeren
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                tvh/<span className="text-blue-600">{productId}</span>
              </h2>
              <div className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                Product Details
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
             <button
              onClick={handleSave}
              disabled={isUploading || (images.length === 0 && !description.trim())}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200"
            >
              {isUploading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {isUploading ? "Verzenden..." : "Opslaan"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Left: Description Section */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                <AlignLeft size={16} className="text-blue-500" />
                Omschrijving
              </label>
              <button
                onClick={handleAiHelp}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 border border-indigo-100 shadow-sm"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                AI Hulp
              </button>
            </div>

            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full h-64 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none resize-none leading-relaxed"
              placeholder="Schrijf hier een omschrijving of gebruik AI hulp..."
            />
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 font-medium flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">⚠️</span>
                  <span>{error}</span>
                </p>
              </div>
            )}
            <p className="text-[11px] text-slate-400 italic">
              Tip: AI genereert omschrijvingen op basis van het productnummer.
            </p>
          </div>

          {/* Right: Upload Section */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                <ImageIcon size={16} className="text-blue-500" />
                Foto's ({images.length})
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Upload size={14} />
                Toevoegen
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*"
              className="hidden"
            />

            {images.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group bg-slate-50/50"
              >
                <div className="w-16 h-16 bg-white shadow-sm text-slate-300 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:text-blue-500 transition-all">
                  <Camera size={32} />
                </div>
                <div className="text-center">
                  <p className="text-slate-600 font-bold">Maak of kies foto's</p>
                  <p className="text-slate-400 text-xs mt-1">Klik om te uploaden</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {images.map((img) => (
                  <div key={img.id} className="relative aspect-square group rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100">
                    <img src={img.preview} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => removeImage(img.id)}
                        className="p-2 bg-white text-red-500 rounded-full hover:bg-red-50 transition-colors shadow-lg"
                        title="Verwijderen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
                >
                  <Upload size={20} />
                  <span className="text-[10px] font-bold uppercase">Meer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadStep;
