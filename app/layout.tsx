import './globals.css'

export const metadata = {
  title: 'Rhythm&Tune',
  description: 'A web-based tuner and metronome application',
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#68be8d',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rhythm&Tune" />
        <meta name="theme-color" content="#68be8d"></meta>
      </head>
      <body>
        {children}
        <footer className="footer">
          <span>Rhythm&Tune</span>
        </footer>
      </body>
    </html>
  )
}