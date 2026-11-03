import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0E0D10',
};

export const metadata: Metadata = {
  title: 'KAIROS — Disciplina y Entrenamiento Basado en Ciencia',
  description:
    'Santuario personal de entrenamiento físico, rutinas inteligentes basadas en ciencia y temporización precisa.',
  applicationName: 'KAIROS',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KAIROS',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans antialiased bg-background text-brand selection:bg-gothic/30 selection:text-brand">
        {children}
      </body>
    </html>
  );
}
