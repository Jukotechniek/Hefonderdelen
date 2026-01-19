
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
import { shopifyService } from '../services/shopifyService';
import { GoogleGenAI } from "@google/genai";

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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Schrijf een zeer korte, krachtige en professionele technische productomschrijving in het Nederlands voor een onderdeel met ID tvh/${productId}. Focus op kwaliteit en industrieel gebruik. Geen markdown, geen inleiding, alleen de omschrijving zelf.`,
      });
      
      const generatedText = response.text || "";
      onDescriptionChange(generatedText.trim());
    } catch (err) {
      console.error("AI Generation failed", err);
      setError("AI kon geen tekst genereren. Probeer het handmatig.");
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
    try {
      const result = await shopifyService.uploadToShopify(productId, images, description);
      if (result.success) {
        onSuccess();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Er is iets fout gegaan bij het opslaan.');
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
              <p className="text-xs text-red-500 font-medium">{error}</p>
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
