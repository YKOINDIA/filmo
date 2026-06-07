import type { Metadata } from 'next'
import AgeyApp from './AgeyApp'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: 'Filmo Agey — 名前・間柄・年齢のメモ',
  description:
    '社会人仲間や子供の友達、その兄弟など「名前・間柄・だいたいの年齢」をかんたんにメモ。誕生日がわかる人はいまの正確な年齢（◯歳◯か月）を自動計算。保育園・クラス・会社などのグループタグで検索・並び替えもできます。',
  openGraph: {
    type: 'website',
    title: 'Filmo Agey — 名前・間柄・年齢のメモ',
    description:
      '社会人仲間や子供の友達・その兄弟の名前・間柄・年齢をかんたんメモ。誕生日がわかる人は正確な年齢を自動計算。グループで検索・並び替えも。',
    url: `${APP_URL}/agey`,
    siteName: 'Filmo',
  },
}

export default function AgeyPage() {
  return <AgeyApp />
}
