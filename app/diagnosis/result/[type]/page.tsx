import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DIAGNOSIS_TYPES, getTypeById } from '../../../lib/diagnosis/types'
import DiagnosisResult from '../../DiagnosisResult'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

// 15 タイプ分を静的生成
export function generateStaticParams() {
  return DIAGNOSIS_TYPES.map(t => ({ type: t.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type: typeId } = await params
  const type = getTypeById(typeId)
  if (!type) {
    return { title: '映画好き診断 | Filmo' }
  }
  const title = `${type.emoji} ${type.name} — 映画好き診断 | Filmo`
  const description = `${type.tagline}。あなたの映画タイプは何タイプ？8つの質問でわかる無料の映画好き診断。`
  const url = `${APP_URL}/diagnosis/result/${type.id}`
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title: `私の映画タイプは「${type.name}」${type.emoji}`,
      description,
      url,
      siteName: 'Filmo',
    },
    twitter: {
      card: 'summary_large_image',
      title: `私の映画タイプは「${type.name}」${type.emoji}`,
      description,
    },
  }
}

export default async function DiagnosisResultPage({ params }: { params: Promise<{ type: string }> }) {
  const { type: typeId } = await params
  const type = getTypeById(typeId)
  if (!type) notFound()

  return (
    <div style={{ background: '#0a0b14', minHeight: '100dvh', color: '#e0e0e0', paddingTop: 24 }}>
      <DiagnosisResult type={type} variant="page" />
    </div>
  )
}
