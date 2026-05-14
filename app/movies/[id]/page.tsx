import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchPublicWork,
  buildWorkTitle,
  buildWorkDescription,
  buildWorkUrl,
  buildPosterUrl,
  buildWorkJsonLd,
  PublicWorkView,
} from '@/app/components/PublicWorkView'

// TMDB は時々データが更新されるので 24h 単位で revalidate(キャッシュレイヤと一致)。
export const revalidate = 86400

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const work = await fetchPublicWork(id, 'movie')
  if (!work) {
    return { title: '作品が見つかりません', robots: { index: false, follow: false } }
  }
  const title = buildWorkTitle(work)
  const description = buildWorkDescription(work)
  const url = buildWorkUrl(work)
  const image = buildPosterUrl(work.poster_path, 'w780')

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'video.movie',
      url,
      siteName: 'Filmo',
      title,
      description,
      images: image ? [{ url: image, width: 780, height: 1170, alt: work.title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params
  const work = await fetchPublicWork(id, 'movie')
  if (!work) notFound()

  const jsonLd = buildWorkJsonLd(work)
  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify は </script を含む可能性のある値があれば エスケープすべきだが、
        // ここで使うのは TMDB / DB 由来の構造化データなので実害は低い。念のため最低限のサニタイズ。
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <PublicWorkView work={work} />
    </>
  )
}
