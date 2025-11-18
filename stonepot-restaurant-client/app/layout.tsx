import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stonepot Restaurant',
  description: 'Voice-powered restaurant ordering with multimodal display'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
