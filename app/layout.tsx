import type { Metadata, Viewport } from 'next'
import { Inter, Press_Start_2P } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { RewardToast } from '@/components/reward-toast'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
  display: 'swap',
});

const pressStart2P = Press_Start_2P({ 
  weight: "400",
  subsets: ["latin"],
  variable: '--font-pixel',
  display: 'swap',
});

const extensionAttributeCleanupScript = `
(() => {
  const shouldRemove = (name) =>
    name.startsWith('bis_') ||
    name.startsWith('__processed_') ||
    name === 'data-new-gr-c-s-check-loaded' ||
    name === 'data-gr-ext-installed';

  const clean = (node) => {
    if (!node || node.nodeType !== 1) return;

    for (const attr of Array.from(node.attributes)) {
      if (shouldRemove(attr.name)) node.removeAttribute(attr.name);
    }
  };

  const cleanTree = () => {
    clean(document.documentElement);
    document.querySelectorAll('*').forEach(clean);
  };

  cleanTree();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') clean(mutation.target);
      mutation.addedNodes.forEach((node) => {
        clean(node);
        if (node.querySelectorAll) node.querySelectorAll('*').forEach(clean);
      });
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  window.setTimeout(() => observer.disconnect(), 8000);
})();
`;

export const metadata: Metadata = {
  title: 'PlantCraft - Gamified Plant Care',
  description: 'Take care of your plants with AR and gamification. Earn coins, level up, and decorate your plants!',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#5C8A3C',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${pressStart2P.variable} scroll-smooth`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Script
          id="extension-attribute-cleanup"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: extensionAttributeCleanupScript }}
        />
        {children}
        <RewardToast />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
