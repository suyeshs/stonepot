import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { fetchTheme } from './lib/theme-loader';
import { generateCSSVariables } from './lib/css-generator';

export const metadata: Metadata = {
  title: 'Stonepot Restaurant',
  description: 'Voice-powered restaurant ordering with multimodal display'
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch theme server-side with ISR caching (1 hour)
  const theme = await fetchTheme();

  // Generate CSS variables from theme
  const cssVariables = generateCSSVariables(theme);

  return (
    <html lang="en">
      <head>
        {/* Inject dynamic theme CSS variables */}
        <style
          id="theme-variables"
          dangerouslySetInnerHTML={{ __html: cssVariables }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider initialTheme={theme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
