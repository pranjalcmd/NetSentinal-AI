import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = { themeColor: '#04060c' };

export const metadata: Metadata = {
  title: { template: '%s | NetSentinal AI', default: 'NetSentinal AI · Network Forensics' },
  description:
    'Enterprise network-forensics and incident-response console. Real-time sensor telemetry, packet-level evidence, AI-correlated findings.',
  keywords: ['cybersecurity', 'network forensics', 'PCAP analysis', 'threat detection', 'NetSentinal'],
  authors: [{ name: 'NetSentinal AI' }],

  robots: { index: false, follow: false },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=IBM+Plex+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#04060c' }}>
        {children}
      </body>
    </html>
  );
}
