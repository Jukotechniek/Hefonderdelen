import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TVH Foto Upload',
  description: 'Upload product foto\'s en beschrijvingen',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
