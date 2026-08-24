import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RIP — социальная сеть, где всё умирает',
    short_name: 'RIP',
    description: 'Сообщения живут, умирают и воскресают в сезонах. Внимание продаётся. Мир регулярно умирает.',
    start_url: '/feed',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#0a0a0c',
    lang: 'ru',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
