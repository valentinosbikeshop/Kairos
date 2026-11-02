import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KAIROS — Disciplina y Entrenamiento',
    short_name: 'KAIROS',
    description:
      'Entrenamiento personal basado en ciencia, rutinas adaptativas y control preciso.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E0D10',
    theme_color: '#0E0D10',
    lang: 'es-ES',
    categories: ['fitness', 'health', 'sports'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
