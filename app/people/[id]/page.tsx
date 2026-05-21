import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  fetchPublicPerson,
  fetchPersonReviews,
  shouldIndexPerson,
  buildPersonTitle,
  buildPersonDescription,
  buildPersonUrl,
  buildPersonImageUrl,
  buildPersonJsonLd,
  PublicPersonView,
} from '@/app/components/PublicPersonView'

// TMDB プロフィールは 48h、レビューは投稿で動く可能性があるので 1h で再生成。
// 短い方を採用。
export const revalidate = 3600

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const person = await fetchPublicPerson(id)
  if (!person) {
    return { title: '人物が見つかりません', robots: { index: false, follow: false } }
  }
  const { stats } = await fetchPersonReviews(person.id)
  const title = buildPersonTitle(person)
  const description = buildPersonDescription(person)
  const url = buildPersonUrl(person)
  const image = buildPersonImageUrl(person.profile_path, 'h632')

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: shouldIndexPerson(stats)
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: 'profile',
      locale: 'ja_JP',
      url,
      siteName: 'Filmo',
      title,
      description,
      images: image ? [{ url: image, alt: person.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params
  const person = await fetchPublicPerson(id)
  if (!person) notFound()

  const { reviews, stats } = await fetchPersonReviews(person.id)
  const jsonLd = buildPersonJsonLd(person, stats, reviews)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <PublicPersonView person={person} reviews={reviews} reviewStats={stats} />
    </>
  )
}
