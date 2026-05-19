import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchPublicWork,
  fetchFilmoCommunity,
  buildWorkTitle,
  buildWorkDescription,
  buildWorkUrl,
  buildPosterUrl,
  buildWorkJsonLd,
  PublicWorkView,
} from '@/app/components/PublicWorkView'

export const revalidate = 86400

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const work = await fetchPublicWork(id, 'tv')
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
    openGraph: {
      type: 'video.tv_show',
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

export default async function TvPage({ params }: Props) {
  const { id } = await params
  const work = await fetchPublicWork(id, 'tv')
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
