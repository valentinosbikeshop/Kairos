import type { Metadata, Viewport } from 'next';
import { Cinzel, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-gothic',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

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
    <html
      lang="es"
      className={`dark ${cinzel.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased bg-background text-brand selection:bg-gothic/30 selection:text-brand">
        {children}
      </body>
    </html>
  );
}
