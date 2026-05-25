import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Controle Financeiro',
    short_name: 'Controle CF',
    description: 'Portal pessoal de controle financeiro.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1c1c1a',
    theme_color: '#1c1c1a',
    orientation: 'portrait',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
