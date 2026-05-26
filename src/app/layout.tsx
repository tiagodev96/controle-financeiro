import type { Metadata, Viewport } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { THEME_COOKIE, resolveTheme } from '@/lib/theme/cookie';
import './globals.css';

const sans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Controle Financeiro',
  description: 'Portal pessoal de controle financeiro.',
  applicationName: 'Controle CF',
  appleWebApp: {
    capable: true,
    title: 'Controle CF',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1c1c1a' },
    { media: '(prefers-color-scheme: light)', color: '#f7f4ee' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      data-theme={theme}
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-base text-fg1">
        {children}
      </body>
    </html>
  );
}
