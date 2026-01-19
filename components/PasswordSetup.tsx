import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';

interface PasswordSetupProps {
  user: any;
  onComplete: () => void;
}

const PasswordSetup: React.FC<PasswordSetupProps> = ({ user, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validatie
      if (password !== confirmPassword) {
        setError('Wachtwoorden komen niet overeen');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Wachtwoord moet minimaal 6 tekens lang zijn');
        setLoading(false);
        return;
      }

      // Update wachtwoord via updateUser
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          password_set: true,
          has_password: true
        }
      });

      if (updateError) {
        throw updateError;
      }

      // Markeer dat wachtwoord is ingesteld
      setSuccess(true);
      
      // Refresh session om metadata bij te werken
      await supabase.auth.refreshSession();
      
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err: any) {
      console.error('Password setup error:', err);
      setError(err.message || 'Er is iets fout gegaan bij het instellen van je wachtwoord.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md w-full mx-auto p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Wachtwoord ingesteld!</h2>
          <p className="text-slate-500">Je wordt doorgestuurd...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mx-auto mb-4">
          <Lock size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Wachtwoord instellen</h2>
        <p className="text-slate-500 mt-2">Kies een wachtwoord voor je account</p>
        <p className="text-sm text-slate-400 mt-1">{user?.email}</p>
      </div>

      <form onSubmit={handlePasswordSetup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nieuw wachtwoord</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="••••••••"
            required
            minLength={6}
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bevestig wachtwoord</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Wachtwoord instellen...
            </>
          ) : (
            <>
              <Lock size={20} />
              Wachtwoord instellen
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default PasswordSetup;
