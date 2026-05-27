'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (`public/sw.js`) no client após o mount. Roda
 * uma vez por sessão; o browser deduplica registros pra mesma URL.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Só em prod — em dev o Next.js serve com cache desabilitado e o SW
    // pode interferir com HMR.
    if (process.env.NODE_ENV !== 'production') return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (err) {
        console.warn('PWA: falha ao registrar service worker', err);
      }
    };

    // Atrasa um tick pra não competir com paint inicial.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
