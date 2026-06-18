import type { Metadata } from 'next'
import DiagnosisApp from './DiagnosisApp'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: '映画好き診断 — あなたに合う映画を診断 | Filmo',
  description:
    'かんたんな8つの質問に答えるだけで、あなたの「映画タイプ」が分かる無料診断。15タイプからあなたにぴったりのおすすめ映画も提案。結果はX・LINEでシェアできます。',
  openGraph: {
    type: 'website',
    title: '映画好き診断 — あなたに合う映画を診断',
    description: '8つの質問であなたの映画タイプを診断。ぴったりのおすすめ映画も分かる無料診断。',
    url: `${APP_URL}/diagnosis`,
    siteName: 'Filmo',
  },
}

export default function DiagnosisPage() {
  return <DiagnosisApp />
}
