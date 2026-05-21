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
import { getServerDictionary, toOgLocale, alternateOgLocales } from '@/app/lib/i18n/server'

// 多言語化のため cookies()/headers() を読むので、export const revalidate は無効化される。
// データ層(tmdb-cache)は別途キャッシュ済みなので、HTML レンダリングのみがリクエスト毎。

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const { locale, t } = await getServerDictionary()
  const work = await fetchPublicWork(id, 'movie')
  if (!work) {
    return { title: t('publicWork.notFoundTitle'), robots: { index: false, follow: false } }
  }
  const community = await fetchFilmoCommunity(work.id)
  const title = buildWorkTitle(work, t)
  const description = buildWorkDescription(work, t, community)
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
      url,
      siteName: 'Filmo',
      title,
      description,
      locale: toOgLocale(locale),
      alternateLocale: alternateOgLocales(locale),
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
  const { t } = await getServerDictionary()
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
      <PublicWorkView work={work} community={community} t={t} />
    </>
  )
}
