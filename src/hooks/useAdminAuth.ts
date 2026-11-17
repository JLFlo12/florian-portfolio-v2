import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mot de passe gardé en mémoire le temps de la visite (jamais enregistré) et partagé entre les pages
let session = '';
export const currentAdminPassword = () => session;

/* Entrée du mode admin : invisible pour les visiteurs.
   Ouvrir /projects?admin affiche le bouton ; le choix est retenu pour l'onglet. */
export const adminEntry = () => {
  try {
    if (new URLSearchParams(window.location.search).has('admin')) sessionStorage.setItem('florian-admin', '1');
    return sessionStorage.getItem('florian-admin') === '1';
  } catch {
    return false;
  }
};

export const useAdminAuth = () => {
  const [adminPassword, setAdminPassword] = useState(session);
  const [entry] = useState(adminEntry);

  const login = useCallback(async (password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-projects', {
        headers: { 'x-admin-password': password },
        body: { action: 'verify' },
      });
      if (error || !data?.success) return false;
      session = password;
      setAdminPassword(password);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    session = '';
    setAdminPassword('');
  }, []);

  return { isAdmin: !!adminPassword, adminPassword, entry: entry || !!adminPassword, login, logout };
};
