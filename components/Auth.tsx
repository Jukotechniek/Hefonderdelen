
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogIn, UserPlus, Loader2, Sparkles } from 'lucide-react';

interface AuthProps {
  onLogin: (user: any) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = mode === 'login' 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) throw error;
      if (data.user) onLogin(data.user);
    } catch (err: any) {
      setError(err.message + " (Probeer de demo login knop hieronder)");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    onLogin({ email: 'demo@tvh.com', id: 'demo-user-123' });
  };

  return (
    <div className="max-w-md w-full mx-auto p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800">Welkom</h2>
        <p className="text-slate-500 mt-2">Log in om producten naar Shopify te sturen</p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="naam@bedrijf.nl"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Wachtwoord</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="••••••••"
            required
          />
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />)}
          {mode === 'login' ? 'Inloggen' : 'Registreren'}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-slate-400 uppercase tracking-wider text-xs font-semibold">Of gebruik</span>
        </div>
      </div>

      <button
        onClick={handleDemoLogin}
        className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-200"
      >
        <Sparkles size={18} className="text-amber-500" />
        Snel inloggen (Demo)
      </button>

      <div className="mt-6 text-center">
        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {mode === 'login' ? 'Nog geen account? Registreer hier' : 'Al een account? Log hier in'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
