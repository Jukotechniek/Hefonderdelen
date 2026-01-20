'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Auth from '../components/Auth';
import PasswordSetup from '../components/PasswordSetup';
import ProductStep from '../components/ProductStep';
import UploadStep from '../components/UploadStep';
import { AppState, UploadedFile } from '../types';
import { LogOut, Package } from 'lucide-react';

export default function Home() {
  const [state, setState] = useState<AppState>({
    step: 'auth',
    productId: '',
    description: '',
    images: [],
    user: null,
  });
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

  useEffect(() => {
    // Check of Supabase geconfigureerd is
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    
    if (typeof window !== 'undefined' && supabaseUrl && supabaseUrl !== '' && supabaseUrl !== 'https://placeholder.supabase.co' && !supabaseUrl.includes('placeholder')) {
      // Detecteer Supabase invite links (type=invite) – ondersteunt token, token_hash en hash-params
      const searchParams = new URLSearchParams(window.location.search);
      const hashString = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hashString);

      const isInviteType =
        searchParams.get('type') === 'invite' ||
        hashParams.get('type') === 'invite';

      const hasInviteToken =
        isInviteType ||
        searchParams.has('invite_token') ||
        searchParams.has('token') ||
        searchParams.has('token_hash');

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const user = session.user;
          const isRecentUser = user.created_at && 
            (new Date().getTime() - new Date(user.created_at).getTime()) < 5 * 60 * 1000;
          
          const isInvited = hasInviteToken || 
                           user.app_metadata?.invited_at || 
                           user.user_metadata?.invited === true ||
                           (isRecentUser && !user.user_metadata?.password_set);
          
          if (isInvited) {
            setNeedsPasswordSetup(true);
            setState(prev => ({ ...prev, user: session.user, step: 'password-setup' }));
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setState(prev => ({ ...prev, user: session.user, step: 'input' }));
          }
        }
      }).catch((err) => {
        console.error('Supabase session check failed:', err);
        // Blijf op auth scherm als Supabase faalt
        setState(prev => ({ ...prev, user: null, step: 'auth' }));
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const user = session.user;
          
          // Check of dit een invite is: 
          // 1. URL heeft invite parameters
          // 2. User heeft invite metadata
          // 3. User is recent aangemaakt (binnen laatste 5 minuten) - workaround voor invite detection
          const isRecentUser = user.created_at && 
            (new Date().getTime() - new Date(user.created_at).getTime()) < 5 * 60 * 1000;
          
          const isInvited = hasInviteToken || 
                           user.app_metadata?.invited_at || 
                           user.user_metadata?.invited === true ||
                           (isRecentUser && _event === 'SIGNED_IN' && !user.user_metadata?.password_set);
          
          if (isInvited && _event === 'SIGNED_IN') {
            // Forceer wachtwoord setup voor invited users
            setNeedsPasswordSetup(true);
            setState(prev => ({ ...prev, user: session.user, step: 'password-setup' }));
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setNeedsPasswordSetup(false);
            setState(prev => ({ ...prev, user: session.user, step: 'input' }));
          }
        } else {
          setNeedsPasswordSetup(false);
          setState(prev => ({ ...prev, user: null, step: 'auth' }));
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // Supabase niet geconfigureerd - blijf op auth scherm
      console.warn('Supabase niet geconfigureerd. Configureer NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY in je .env bestand.');
      setState(prev => ({ ...prev, user: null, step: 'auth' }));
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setState({ step: 'auth', productId: '', description: '', images: [], user: null });
  };

  const renderHeader = () => (
    <header className="bg-white border-b border-slate-200 px-6 py-4 mb-8 flex justify-between items-center sticky top-0 z-10 w-full">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <Package size={20} />
        </div>
        <h1 className="font-bold text-lg text-slate-800 tracking-tight">Hefonderdelen <span className="text-blue-600">Foto Upload</span></h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500 hidden sm:inline">{state.user?.email}</span>
        <button 
          onClick={handleLogout}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
          title="Uitloggen"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {state.step !== 'auth' && state.step !== 'password-setup' && renderHeader()}
      
      <main className="flex-1 flex items-center justify-center p-4">
        {state.step === 'auth' && (
          <Auth onLogin={(user) => setState(prev => ({ ...prev, user, step: 'input' }))} />
        )}

        {state.step === 'password-setup' && state.user && (
          <PasswordSetup 
            user={state.user} 
            onComplete={() => {
              setNeedsPasswordSetup(false);
              setState(prev => ({ ...prev, step: 'input' }));
            }} 
          />
        )}

        {state.step === 'input' && (
          <ProductStep 
            value={state.productId} 
            onChange={(val) => setState(prev => ({ ...prev, productId: val }))}
            onNext={() => setState(prev => ({ ...prev, step: 'details' }))}
          />
        )}

        {state.step === 'details' && (
          <UploadStep 
            productId={state.productId}
            description={state.description}
            onDescriptionChange={(val) => setState(prev => ({ ...prev, description: val }))}
            images={state.images}
            onImagesChange={(images) => setState(prev => ({ ...prev, images }))}
            onBack={() => setState(prev => ({ ...prev, step: 'input' }))}
            onSuccess={() => setState(prev => ({ ...prev, step: 'success' }))}
          />
        )}

        {state.step === 'success' && (
          <div className="max-w-md w-full mx-auto p-12 bg-white rounded-2xl shadow-xl border border-slate-100 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Gelukt!</h2>
            <p className="text-slate-500 mb-8">Het product <span className="font-semibold text-slate-800">tvh/{state.productId}</span> is succesvol opgeslagen.</p>
            <button
              onClick={() => setState({ ...state, step: 'input', productId: '', description: '', images: [] })}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all"
            >
              Nieuw product
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
