import './globals.css'

export const metadata = {
  title: 'Web Tuner Metronome',
  description: 'A web-based tuner and metronome application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}