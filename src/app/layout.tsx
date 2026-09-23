import type { Metadata, Viewport } from 'next'
import { Figtree, Geist, Instrument_Serif, Inter, Sora } from 'next/font/google'
import { ThemeProvider, themeInitScript } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

/** The marketing site's one grotesque, for headings and body alike. */
/** The dashboard's text face: rounded, open and soft at small sizes. */
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  // 800 is never used; every display heading is 600 (base CSS) or 700.
  weight: ['400', '500', '600', '700'],
})

/**
 * One editorial voice for the marketing site — pull quotes and a single
 * italic word in a headline. Loaded in its two real styles only.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://ezrapro.com'),
  title: {
    default: 'EZRA Pro — Booking software for experiences that sell out',
    template: '%s · EZRA Pro',
  },
  description:
    'The booking and revenue platform for watersports, tours, adventure and hospitality operators. Live availability, zero-friction checkout, and analytics that actually tell you what to do next.',
  keywords: [
    'booking software',
    'tour operator software',
    'watersports booking',
    'activity booking platform',
    'reservation system',
  ],
  openGraph: {
    type: 'website',
    siteName: 'EZRA Pro',
    title: 'EZRA Pro — Booking software for experiences that sell out',
    description:
      'Live availability, zero-friction checkout, and analytics that tell you what to do next. Built for tours, watersports, adventure and hospitality.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EZRA Pro — Booking software for experiences that sell out',
    description: 'The booking and revenue platform for experience operators.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfcfd' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1519' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${figtree.variable} ${geist.variable} ${sora.variable} ${instrumentSerif.variable}`}>
      <head>
        {/* Applies the stored theme before first paint — prevents a flash of the wrong scheme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
