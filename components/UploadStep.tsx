
import React, { useRef, useState, useEffect } from 'react';
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
  const [showDescriptionConfirm, setShowDescriptionConfirm] = useState(false);
  const [existingDescription, setExistingDescription] = useState<string | null>(null);
  const [pendingDescription, setPendingDescription] = useState<string>('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [existingFilesInfo, setExistingFilesInfo] = useState<{hasPhotos: boolean, hasDescription: boolean, existingPhotos: string[]} | null>(null);
  const [showExistingDataWarning, setShowExistingDataWarning] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [existingPhotoFiles, setExistingPhotoFiles] = useState<Array<{url: string, path: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check bij mount of er al foto's en/of beschrijving bestaan
  React.useEffect(() => {
    const checkExistingData = async () => {
      if (!productId) return;
      
      const articleNumber = `TVH/${productId}`;
      
      // Check database voor beschrijving
      const { data: productData } = await supabase
        .from('products')
        .select('shopify_description')
        .eq('article_number', articleNumber)
        .single();
      
      const hasDescription = productData?.shopify_description && productData.shopify_description.trim().length > 0;
      
      // Laad bestaande beschrijving in textarea als die bestaat
      if (hasDescription && productData.shopify_description) {
        onDescriptionChange(productData.shopify_description);
      }
      
      // Check Storage voor foto's
      const folderPath = `tvh-${productId}/`;
      const { data: files, error } = await supabase.storage
        .from('product-images')
        .list(folderPath, {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });
      
      const existingPhotos: string[] = [];
      const existingPhotoFilesList: Array<{url: string, path: string}> = [];
      if (!error && files && files.length > 0) {
        // Haal publieke URLs op voor bestaande foto's
        for (const file of files) {
          if (file.name && (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg') || file.name.endsWith('.png'))) {
            const filePath = `${folderPath}${file.name}`;
            const { data: urlData } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);
            if (urlData?.publicUrl) {
              existingPhotos.push(urlData.publicUrl);
              existingPhotoFilesList.push({ url: urlData.publicUrl, path: filePath });
            }
          }
        }
      }
      setExistingPhotoFiles(existingPhotoFilesList);
      
      const hasPhotos = existingPhotos.length > 0;
      
      if (hasPhotos || hasDescription) {
        setExistingFilesInfo({
          hasPhotos,
          hasDescription: !!hasDescription,
          existingPhotos
        });
        
        // Als beide bestaan, toon waarschuwing
        if (hasPhotos && hasDescription) {
          setShowExistingDataWarning(true);
        }
        
        // Als alleen foto's bestaan, laad ze in en maak upload disabled
        if (hasPhotos && !hasDescription) {
          // Converteer URLs naar UploadedFile format (voor preview)
          // We kunnen de foto's niet echt als File objecten maken, maar we kunnen ze wel tonen
          // Voor nu: toon melding dat gebruiker alleen beschrijving kan toevoegen
        }
      }
    };
    
    checkExistingData();
  }, [productId]);

  const saveDescription = async (desc: string, existingProduct: any) => {
    try {
      const articleNumber = `TVH/${productId}`;
      
      if (existingProduct) {
        // Update bestaand product
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            shopify_description: desc,
            updated_at: new Date().toISOString()
          })
          .eq('article_number', articleNumber);

        if (updateError) {
          throw new Error(`Fout bij updaten van product: ${updateError.message}`);
        }
        console.log('Beschrijving bijgewerkt voor product:', productId);
      } else {
        // Maak nieuw product aan
        const { error: insertError } = await supabase
          .from('products')
          .insert({
            article_number: articleNumber,
            product_name: `TVH ${productId}`, // Verplicht veld
            shopify_description: desc
          });

        if (insertError) {
          throw new Error(`Fout bij aanmaken van product: ${insertError.message}`);
        }
        console.log('Nieuw product aangemaakt met beschrijving:', productId);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const handleConfirmOverwrite = async () => {
    setIsUploading(true);
    setShowDescriptionConfirm(false);
    try {
      const articleNumber = `TVH/${productId}`;
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id, article_number')
        .eq('article_number', articleNumber)
        .single();

      await saveDescription(pendingDescription, existingProduct);
      
      // Ga door met success
      if (uploadedUrls.length > 0 || images.length === 0) {
        onSuccess();
      } else {
        throw new Error('Geen foto\'s geüpload');
      }
    } catch (err: any) {
      console.error('Error saving description:', err);
      setError(`Fout bij opslaan van beschrijving: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleCancelOverwrite = () => {
    setShowDescriptionConfirm(false);
    setExistingDescription(null);
    setPendingDescription('');
    setIsUploading(false);
    // Stop hier - gebruiker wil terug om tekst aan te passen
    // Foto's zijn al geüpload, maar beschrijving wordt niet opgeslagen
  };

  const handleAiHelp = async () => {
    if (isGenerating) return;
    
    if (!description || description.trim() === '') {
      setError('⚠️ Voer eerst een beschrijving in voordat je AI hulp gebruikt.');
      return;
    }

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
    if (!window.confirm('Weet je zeker dat je deze foto wilt verwijderen?')) {
      return;
    }
    const imgToRemove = images.find(img => img.id === id);
    if (imgToRemove) URL.revokeObjectURL(imgToRemove.preview);
    onImagesChange(images.filter(img => img.id !== id));
  };

  const removeExistingPhoto = async (photoPath: string, index: number) => {
    if (!window.confirm('Weet je zeker dat je deze foto wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.')) {
      return;
    }
    try {
      const { error } = await supabase.storage
        .from('product-images')
        .remove([photoPath]);

      if (error) {
        console.error('Error removing photo:', error);
        setError(`Fout bij verwijderen van foto: ${error.message}`);
        return;
      }

      // Update state
      const updatedPhotos = existingPhotoFiles.filter((_, i) => i !== index);
      setExistingPhotoFiles(updatedPhotos);
      
      if (existingFilesInfo) {
        setExistingFilesInfo({
          ...existingFilesInfo,
          hasPhotos: updatedPhotos.length > 0,
          existingPhotos: updatedPhotos.map(p => p.url)
        });
      }
    } catch (err: any) {
      console.error('Error removing existing photo:', err);
      setError(`Fout bij verwijderen van foto: ${err.message}`);
    }
  };

  const handleSave = async () => {
    // Check of er foto's zijn (bestaand of nieuw)
    const totalPhotos = existingPhotoFiles.length + images.length;
    
    if (totalPhotos === 0) {
      setError("Foto's zijn verplicht. Voeg minimaal één foto toe voordat je kunt opslaan.");
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
              // Upload naar tvh-{productId}/ met bestandsnamen {productId}-{nummer}.jpg
              // Nummering: start vanaf aantal bestaande foto's + 1
              const fileExt = img.file.name.split('.').pop() || 'jpg';
              const startNumber = existingPhotoFiles.length + 1;
              const imageNumber = images.indexOf(img) + startNumber;
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

      // Opslaan van beschrijving in database (als ingevuld)
      if (description && description.trim().length > 0) {
        try {
          const articleNumber = `TVH/${productId}`;
          
          // Check of product al bestaat en of er al een shopify_description is
          const { data: existingProduct, error: searchError } = await supabase
            .from('products')
            .select('id, article_number, shopify_description')
            .eq('article_number', articleNumber)
            .single();

          if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error searching for product:', searchError);
            throw new Error(`Fout bij zoeken naar product: ${searchError.message}`);
          }

          // Als product bestaat en heeft al een shopify_description, vraag bevestiging
          if (existingProduct && existingProduct.shopify_description && existingProduct.shopify_description.trim().length > 0) {
            setUploadedUrls(uploadedUrls); // Sla URLs op voor later gebruik
            setExistingDescription(existingProduct.shopify_description);
            setPendingDescription(description.trim());
            setShowDescriptionConfirm(true);
            setIsUploading(false);
            return; // Stop hier en wacht op bevestiging
          }

          // Geen bestaande beschrijving, sla direct op
          await saveDescription(description.trim(), existingProduct);
        } catch (dbError: any) {
          console.error('Database error:', dbError);
          throw new Error(`Fout bij opslaan van beschrijving: ${dbError.message}`);
        }
      }

      // Alles is opgeslagen in Supabase Storage
      setUploadedUrls(uploadedUrls);
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
    <>
      {/* Waarschuwing als beide al bestaan */}
      {showExistingDataWarning && existingFilesInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Product bestaat al</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Dit product heeft al foto's en een beschrijving. Het is niet nodig om deze opnieuw toe te voegen.
              </p>
              
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span className="text-sm text-slate-700">Foto's: {existingFilesInfo.existingPhotos.length} foto(s) aanwezig</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-600" />
                    <span className="text-sm text-slate-700">Beschrijving: Aanwezig</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowExistingDataWarning(false);
                    onBack();
                  }}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Terug
                </button>
                <button
                  onClick={() => {
                    setShowExistingDataWarning(false);
                    // Laat gebruiker doorgaan om beschrijving te bewerken
                  }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Toch bewerken
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bevestigingsdialoog voor overschrijven beschrijving */}
      {showDescriptionConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 sm:p-8">
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Bestaande beschrijving gevonden</h3>
              <p className="text-slate-600 mb-6">
                Er bestaat al een shopify_description voor dit product. Wil je deze overschrijven?
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-700 mb-2 text-sm uppercase tracking-wide">Bestaande beschrijving</h4>
                  <div className="bg-slate-50 rounded p-3 text-sm text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {existingDescription || '(Leeg)'}
                  </div>
                </div>
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
                  <h4 className="font-semibold text-blue-700 mb-2 text-sm uppercase tracking-wide">Nieuwe beschrijving</h4>
                  <div className="bg-white rounded p-3 text-sm text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {pendingDescription}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancelOverwrite}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleConfirmOverwrite}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Overschrijven
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              disabled={isUploading || (images.length === 0 && !existingFilesInfo?.hasPhotos)}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200"
            >
              {isUploading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              {isUploading ? "Verzenden..." : existingFilesInfo?.hasPhotos && !existingFilesInfo.hasDescription ? "Beschrijving opslaan" : "Opslaan"}
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
                Foto's ({existingPhotoFiles.length + images.length})
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

            {/* Toon alle foto's: bestaande + nieuwe */}
            {(existingPhotoFiles.length > 0 || images.length > 0) ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {/* Bestaande foto's */}
                {existingPhotoFiles.map((photo, index) => (
                  <div 
                    key={`existing-${index}`} 
                    className="relative aspect-square group rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Foto geklikt, index:', index);
                      setSelectedPhotoIndex(index);
                    }}
                  >
                    <img 
                      src={photo.url} 
                      alt={`Bestaande foto ${index + 1}`} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                    />
                    <div 
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeExistingPhoto(photo.path, index);
                        }}
                        className="p-2 bg-white text-red-500 rounded-full hover:bg-red-50 transition-colors shadow-lg pointer-events-auto"
                        title="Verwijderen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Nieuwe foto's */}
                {images.map((img, imgIndex) => (
                  <div 
                    key={img.id} 
                    className="relative aspect-square group rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Nieuwe foto geklikt, index:', existingPhotoFiles.length + imgIndex);
                      setSelectedPhotoIndex(existingPhotoFiles.length + imgIndex);
                    }}
                  >
                    <img 
                      src={img.preview} 
                      alt="Preview" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                    />
                    <div 
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(img.id);
                        }}
                        className="p-2 bg-white text-red-500 rounded-full hover:bg-red-50 transition-colors shadow-lg pointer-events-auto"
                        title="Verwijderen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Toevoegen knop */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all"
                >
                  <Upload size={20} />
                  <span className="text-[10px] font-bold uppercase">Meer</span>
                </button>
              </div>
            ) : (
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
            )}
            
            {/* Lightbox voor foto weergave */}
            {selectedPhotoIndex !== null && (
              <div 
                className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4"
                onClick={() => setSelectedPhotoIndex(null)}
              >
                <button
                  onClick={() => setSelectedPhotoIndex(null)}
                  className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-10"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {selectedPhotoIndex < existingPhotoFiles.length ? (
                  <img 
                    src={existingPhotoFiles[selectedPhotoIndex].url}
                    alt="Grote weergave"
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <img 
                    src={images[selectedPhotoIndex - existingPhotoFiles.length]?.preview}
                    alt="Grote weergave"
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default UploadStep;
