import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Competitor Tracker',
  description: 'Track competitor prices and reviews in real-time',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="bg-white shadow">
          <div className="container max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-2xl font-bold text-gray-900">
                🔍 Competitor Tracker
              </h1>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
