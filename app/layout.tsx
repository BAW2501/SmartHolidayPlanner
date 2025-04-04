import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SmartHolidayPlanner',
  description: 'Plan your holidays smartly with SmartHolidayPlanner',
  keywords: ['holiday', 'planner', 'optimizer'],
}
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
