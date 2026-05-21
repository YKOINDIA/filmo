import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchPublicWork,
  fetchFilmoCommunity,
  shouldIndexWork,
  buildWorkTitle,
  buildWorkDescription,
  buildWorkUrl,
  buildPosterUrl,
  buildWorkJsonLd,
  PublicWorkView,
} from '@/app/components/PublicWorkView'

// TMDB は時々データが更新されるので 24h 単位で revalidate(キャッシュレイヤと一致)。
// 意図的に cookies()/headers() を読まず ISR を効かせ、Fluid CPU を抑える。
export const revalidate = 86400

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const work = await fetchPublicWork(id, 'movie')
  if (!work) {
    return { title: '作品が見つかりません', robots: { index: false, follow: false } }
  }
  const community = await fetchFilmoCommunity(work.id)
  const title = buildWorkTitle(work)
  const description = buildWorkDescription(work, community)
  const url = buildWorkUrl(work)
  const image = buildPosterUrl(work.poster_path, 'w780')

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: shouldIndexWork(community)
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: 'video.movie',
      locale: 'ja_JP',
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

  const community = await fetchFilmoCommunity(work.id)
  const jsonLd = buildWorkJsonLd(work, community)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <PublicWorkView work={work} community={community} />
    </>
  )
}
