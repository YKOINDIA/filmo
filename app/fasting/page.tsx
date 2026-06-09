import type { Metadata } from 'next'
import FastingApp from './FastingApp'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: 'Filmo ファスティング — 仲間とゲーム感覚で断食を続ける',
  description:
    'ファスティング(断食)をゲーム感覚で楽しく継続し、アンチエイジングを目指すコミュニティ。いま一緒に頑張る仲間の人数がリアルタイムでわかり、終了後は回復食をシェアして称え合えます。累計時間や連続達成でレベルアップ・称号も。',
  openGraph: {
    type: 'website',
    title: 'Filmo ファスティング — 仲間とゲーム感覚で断食を続ける',
    description:
      'いま一緒に断食を頑張る仲間が見える。終了後は回復食をシェアして応援し合う。レベル・称号でモチベ継続。',
    url: `${APP_URL}/fasting`,
    siteName: 'Filmo',
  },
}

export default function FastingPage() {
  return <FastingApp />
}
