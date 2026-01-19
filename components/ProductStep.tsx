
import React from 'react';
import { ArrowRight, Hash } from 'lucide-react';

interface ProductStepProps {
  value: string;
  onChange: (val: string) => void;
  onNext: () => void;
}

const ProductStep: React.FC<ProductStepProps> = ({ value, onChange, onNext }) => {
  return (
    <div className="max-w-md w-full mx-auto p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="mb-8">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
          <Hash size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Product Identificatie</h2>
        <p className="text-slate-500 mt-2">Voer het unieke nummer van het product in.</p>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="text-slate-400 font-medium">tvh/</span>
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
            className="block w-full pl-[4.5rem] pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
            placeholder="000000"
            autoFocus
          />
        </div>

        <button
          onClick={onNext}
          disabled={!value}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-blue-200"
        >
          Volgende
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default ProductStep;
