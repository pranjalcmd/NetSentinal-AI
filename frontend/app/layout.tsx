import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = { themeColor: '#000000' };

export const metadata: Metadata = {
  title: { template: '%s | PRISM Security', default: 'PRISM — Explainable Threat Analytics & Security Advisory' },
  description:
    'PRISM — Explainable Threat Analytics & Security Advisory console. Real-time sensor telemetry, packet-level evidence, transparent threat findings.',
  keywords: ['cybersecurity', 'threat analytics', 'network forensics', 'PCAP analysis', 'security advisory', 'PRISM'],
  authors: [{ name: 'PRISM Security Advisory' }],

  robots: { index: false, follow: false },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#000' }} className="antialiased bg-black text-white font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
