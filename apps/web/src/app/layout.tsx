import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: { default: 'Voidspace', template: '%s · Voidspace' },
  description: 'Communities that govern themselves, with moderation and admin actions in the open.',
};

export const viewport: Viewport = { themeColor: '#0a0b10' };

// Runs before first paint so a visitor who chose the light theme never sees a dark flash.
const themeScript = `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
