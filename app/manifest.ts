import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TVH Foto Upload',
    short_name: 'TVH Upload',
    description: 'Upload product foto\'s en beschrijvingen',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    orientation: 'any',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    // Screenshots zijn optioneel - verwijder als je ze niet hebt
    // screenshots: [
    //   {
    //     src: '/screenshot-mobile.png',
    //     sizes: '390x844',
    //     type: 'image/png',
    //     form_factor: 'narrow',
    //   },
    //   {
    //     src: '/screenshot-desktop.png',
    //     sizes: '1920x1080',
    //     type: 'image/png',
    //     form_factor: 'wide',
    //   },
    // ],
  };
}
