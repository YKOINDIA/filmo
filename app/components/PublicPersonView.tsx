/**
 * Public, server-rendered person detail page used by /people/[id].
 *
 * Renders a crawlable HTML page with Person JSON-LD so directors / writers /
 * actors can rank on Google. The in-app modal (PersonDetail.tsx) continues to
 * handle the authenticated UX.
 */
import Link from 'next/link'
import { getPersonDetailCached } from '@/app/lib/tmdb-cache'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'
import type { ServerT } from '@/app/lib/i18n/server'
import PersonEditProposalTrigger from './PersonEditProposalTrigger'
import PersonAddWorkTrigger from './PersonAddWorkTrigger'
import AuthGate from './AuthGate'
import PublicShareButton from './PublicShareButton'
import OpenInAppBar from './OpenInAppBar'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

interface CombinedCredit {
  id: number
  title?: string
  name?: string
  media_type?: 'movie' | 'tv'
  poster_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  character?: string
  job?: string
  department?: string
}

export interface ExternalLink {
  /** UI 表示名 (X, Instagram, IMDb, ...) */
  label: string
  /** 完成形 URL */
  url: string
  /** 識別キー (sameAs JSON-LD と key prop に使用) */
  key: string
}

export interface PublicPersonData {
  id: number
  name: string
  also_known_as: string[]
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  profile_path: string | null
  known_for_department: string | null
  homepage: string | null
  external_links: ExternalLink[]
  cast: CombinedCredit[]
  crew: CombinedCredit[]
  director_works: CombinedCredit[]
  writer_works: CombinedCredit[]
}

export interface PublicPersonReview {
  id: string
  user_id: string
  user_name: string
  user_avatar: string | null
  score: number | null
  body: string | null
  likes_count: number
  created_at: string
}

export interface PersonReviewStats {
  count: number
  avg: number | null
}

interface TmdbExternalIds {
  imdb_id?: string | null
  twitter_id?: string | null
  instagram_id?: string | null
  facebook_id?: string | null
  youtube_id?: string | null
  tiktok_id?: string | null
  wikidata_id?: string | null
}

interface TmdbPerson {
  id: number
  name?: string
  also_known_as?: string[]
  biography?: string
  birthday?: string | null
  deathday?: string | null
  place_of_birth?: string | null
  profile_path?: string | null
  known_for_department?: string | null
  homepage?: string | null
  external_ids?: TmdbExternalIds
  combined_credits?: {
    cast?: CombinedCredit[]
    crew?: CombinedCredit[]
  }
}

/** TMDB の external_ids から表示・JSON-LD 用のリンクリストに整形 */
function buildExternalLinks(ext: TmdbExternalIds | undefined, homepage: string | null): ExternalLink[] {
  const links: ExternalLink[] = []
  // TikTok などはハンドルに @ が含まれる場合があるので除去。
  const clean = (s: string) => s.replace(/^@/, '').trim()
  if (ext?.twitter_id) {
    links.push({ key: 'x', label: 'X (Twitter)', url: `https://x.com/${clean(ext.twitter_id)}` })
  }
  if (ext?.instagram_id) {
    links.push({ key: 'instagram', label: 'Instagram', url: `https://www.instagram.com/${clean(ext.instagram_id)}/` })
  }
  if (ext?.tiktok_id) {
    links.push({ key: 'tiktok', label: 'TikTok', url: `https://www.tiktok.com/@${clean(ext.tiktok_id)}` })
  }
  if (ext?.youtube_id) {
    links.push({ key: 'youtube', label: 'YouTube', url: `https://www.youtube.com/${clean(ext.youtube_id)}` })
  }
  if (ext?.facebook_id) {
    links.push({ key: 'facebook', label: 'Facebook', url: `https://www.facebook.com/${clean(ext.facebook_id)}` })
  }
  if (ext?.imdb_id) {
    links.push({ key: 'imdb', label: 'IMDb', url: `https://www.imdb.com/name/${ext.imdb_id}/` })
  }
  if (ext?.wikidata_id) {
    links.push({ key: 'wikidata', label: 'Wikidata', url: `https://www.wikidata.org/wiki/${ext.wikidata_id}` })
  }
  if (homepage) {
    // 公式サイトは TMDB の person.homepage に入っているケースがある (映画と同じスキーマ風)。
    // label は表示時に t('publicPerson.officialSite') で上書きする (ここではフォールバック用に ja)。
    links.push({ key: 'homepage', label: '公式サイト', url: homepage })
  }
  return links
}

export async function fetchPublicPerson(rawId: string): Promise<PublicPersonData | null> {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id === 0) return null

  try {
    const data = (await getPersonDetailCached(id)) as TmdbPerson | null
    if (!data || !data.name) return null

    const cast = (data.combined_credits?.cast || [])
      .filter(c => c.poster_path)
      .sort((a, b) => releaseYear(b) - releaseYear(a))
    const crew = (data.combined_credits?.crew || [])
      .filter(c => c.poster_path)
      .sort((a, b) => releaseYear(b) - releaseYear(a))
    const director_works = crew.filter(c => c.job === 'Director')
    const writer_works = crew.filter(c => c.department === 'Writing')

    return {
      id: data.id,
      name: data.name,
      also_known_as: data.also_known_as || [],
      biography: data.biography || '',
      birthday: data.birthday || null,
      deathday: data.deathday || null,
      place_of_birth: data.place_of_birth || null,
      profile_path: data.profile_path || null,
      known_for_department: data.known_for_department || null,
      homepage: data.homepage || null,
      external_links: buildExternalLinks(data.external_ids, data.homepage || null),
      cast,
      crew,
      director_works,
      writer_works,
    }
  } catch {
    return null
  }
}

function releaseYear(c: CombinedCredit): number {
  const d = c.release_date || c.first_air_date || ''
  return d ? parseInt(d.slice(0, 4), 10) || 0 : 0
}

/**
 * SSR で公開レビューを取得 (上位 N 件 + 集計)。
 * 認証なしでクローラ・未ログインユーザーに見える内容を返す。
 * 隠し / 下書きは出さない。
 */
export async function fetchPersonReviews(
  personId: number,
  limit = 12,
): Promise<{ reviews: PublicPersonReview[]; stats: PersonReviewStats }> {
  const admin = getSupabaseAdmin()
  try {
    const [{ data: rows }, { data: statsRows }] = await Promise.all([
      admin
        .from('person_reviews')
        .select('id, user_id, score, body, likes_count, created_at, users:user_id(name, avatar_url)')
        .eq('person_id', personId)
        .eq('is_hidden', false)
        .eq('is_draft', false)
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit),
      admin.rpc('get_person_review_stats', { p_person_id: personId }),
    ])

    type Row = {
      id: string
      user_id: string
      score: number | null
      body: string | null
      likes_count: number
      created_at: string
      users: { name: string | null; avatar_url: string | null } | null
    }
    const reviews: PublicPersonReview[] = ((rows || []) as unknown as Row[]).map(r => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.users?.name || 'User',
      user_avatar: r.users?.avatar_url || null,
      score: r.score,
      body: r.body,
      likes_count: r.likes_count || 0,
      created_at: r.created_at,
    }))

    const stat = (statsRows as { review_count: number; avg_score: number | null }[] | null)?.[0]
    const stats: PersonReviewStats = {
      count: stat ? Number(stat.review_count) || 0 : 0,
      avg: stat?.avg_score != null ? Number(stat.avg_score) : null,
    }
    return { reviews, stats }
  } catch {
    return { reviews: [], stats: { count: 0, avg: null } }
  }
}

// ── Metadata helpers ────────────────────────────────────────────────────────

function deptLabel(t: ServerT, dept: string): string {
  // 辞書に未登録の department は原文をそのまま返す
  const v = t(`publicPerson.departments.${dept}`)
  return v === `publicPerson.departments.${dept}` ? dept : v
}

export function buildPersonTitle(p: PublicPersonData, t: ServerT): string {
  const role = p.known_for_department ? deptLabel(t, p.known_for_department) : null
  // 兼業の場合(監督 兼 脚本)は監督と脚本のフィルム数で補強
  const extras: string[] = []
  if (p.director_works.length > 0 && p.known_for_department !== 'Directing') extras.push(deptLabel(t, 'Directing'))
  if (p.writer_works.length > 0 && p.known_for_department !== 'Writing') extras.push(deptLabel(t, 'Writing'))
  const combined = [role, ...extras].filter(Boolean).join('・')
  return combined
    ? t('publicPerson.metaTitleWithRoles', { name: p.name, roles: combined })
    : t('publicPerson.metaTitleNoRole', { name: p.name })
}

export function buildPersonDescription(p: PublicPersonData, t: ServerT): string {
  const parts: string[] = []
  if (p.known_for_department) {
    parts.push(deptLabel(t, p.known_for_department))
  }
  if (p.birthday) parts.push(t('publicPerson.metaBirthYear', { year: p.birthday.slice(0, 4) }))
  if (p.place_of_birth) parts.push(t('publicPerson.metaBirthplace', { place: p.place_of_birth }))
  if (p.director_works.length > 0) {
    const titles = p.director_works.slice(0, 3).map(c => c.title || c.name).filter(Boolean).join('・')
    parts.push(t('publicPerson.metaDirectorWorks', { titles }))
  } else if (p.cast.length > 0) {
    const titles = p.cast.slice(0, 3).map(c => c.title || c.name).filter(Boolean).join('・')
    parts.push(t('publicPerson.metaActorWorks', { titles }))
  }
  const head = parts.join(' / ')
  const tail = p.biography ? ` ${p.biography.replace(/\s+/g, ' ').trim()}` : ''
  const desc = `${head}${tail}`.trim()
  return desc.length > 155 ? `${desc.slice(0, 152)}…` : desc
}

export function buildPersonUrl(p: PublicPersonData): string {
  return `${APP_URL}/people/${p.id}`
}

export function buildPersonImageUrl(profilePath: string | null, size: 'w185' | 'w300' | 'h632' | 'original' = 'h632'): string | null {
  if (!profilePath) return null
  return `${TMDB_IMG}/${size}${profilePath}`
}

// ── JSON-LD (Person schema) ─────────────────────────────────────────────────

export function buildPersonJsonLd(
  p: PublicPersonData,
  reviewStats?: PersonReviewStats,
  reviews?: PublicPersonReview[],
): Record<string, unknown> {
  const image = buildPersonImageUrl(p.profile_path, 'h632')
  const url = buildPersonUrl(p)
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    url,
  }
  if (p.also_known_as.length > 0) jsonLd.alternateName = p.also_known_as
  if (image) jsonLd.image = image
  if (p.biography) jsonLd.description = p.biography
  if (p.birthday) jsonLd.birthDate = p.birthday
  if (p.deathday) jsonLd.deathDate = p.deathday
  if (p.place_of_birth) {
    jsonLd.birthPlace = { '@type': 'Place', name: p.place_of_birth }
  }
  if (p.known_for_department) {
    // JSON-LD は ja を採用 (Google は単一値を期待)。
    const JA: Record<string, string> = { Directing: '監督', Writing: '脚本家', Acting: '俳優', Production: 'プロデューサー', Camera: '撮影', Editing: '編集', Sound: '音響', Art: '美術' }
    jsonLd.jobTitle = JA[p.known_for_department] || p.known_for_department
  }
  // sameAs はエンティティ統合の手掛かりとして Google が重視する。
  // X / Instagram / IMDb / Wikidata / 公式サイトを並べる。
  if (p.external_links.length > 0) {
    jsonLd.sameAs = p.external_links.map(l => l.url)
  }
  // 監督作品を knowsAbout/worksFor 風に並べると過剰なので、知名度の高い作品だけ alumniOf 替わりに付ける
  const topWorks = [...p.director_works.slice(0, 5), ...p.cast.slice(0, 5)]
    .filter((w, i, arr) => arr.findIndex(x => x.id === w.id) === i)
    .slice(0, 8)
  if (topWorks.length > 0) {
    jsonLd.subjectOf = topWorks.map(w => ({
      '@type': w.media_type === 'tv' ? 'TVSeries' : 'Movie',
      name: w.title || w.name,
      url: `${APP_URL}/${w.media_type === 'tv' ? 'tv' : 'movies'}/${w.id}`,
    }))
  }

  // Filmo ユーザーの星評価集計と個別レビューを Person schema にぶら下げる。
  // Google のリッチリザルト要件: aggregateRating には review か itemReviewed が
  // 必要なので、最小要件として review を 1 件以上含める。
  if (reviewStats && reviewStats.count > 0 && reviewStats.avg != null) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewStats.avg.toFixed(1),
      bestRating: 5,
      worstRating: 0.5,
      ratingCount: reviewStats.count,
    }
  }
  if (reviews && reviews.length > 0) {
    jsonLd.review = reviews
      .filter(r => r.body && r.body.trim().length > 0)
      .slice(0, 5)
      .map(r => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.user_name },
        datePublished: r.created_at,
        reviewBody: (r.body || '').slice(0, 500),
        ...(r.score != null && {
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.score,
            bestRating: 5,
            worstRating: 0.5,
          },
        }),
      }))
  }
  return jsonLd
}

// ── View ────────────────────────────────────────────────────────────────────

export function PublicPersonView({
  person,
  reviews = [],
  reviewStats = { count: 0, avg: null },
  t,
}: {
  person: PublicPersonData
  reviews?: PublicPersonReview[]
  reviewStats?: PersonReviewStats
  t: ServerT
}) {
  const profile = buildPersonImageUrl(person.profile_path, 'h632')
  const role = person.known_for_department ? deptLabel(t, person.known_for_department) : null
  const personUrl = buildPersonUrl(person)
  const shareTitle = buildPersonTitle(person, t)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)', paddingBottom: 60 }}>
      <header style={{
        borderBottom: '1px solid var(--fm-border)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1.5, color: 'var(--fm-text)', textTransform: 'uppercase' }}>
            Filmo
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PublicShareButton url={personUrl} title={shareTitle} />
          <AuthGate hideWhenAuthed>
            <Link href="/" style={{
              padding: '6px 16px', borderRadius: 6,
              background: 'var(--fm-accent)', color: '#fff', fontSize: 12, fontWeight: 600,
              textDecoration: 'none',
            }}>
              {t('publicPerson.ctaCreateAccount')}
            </Link>
          </AuthGate>
        </div>
      </header>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 20, marginBottom: 24 }}>
          {profile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile} alt={person.name}
              style={{ width: 160, height: 240, objectFit: 'cover', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
            />
          ) : (
            <div style={{ width: 160, height: 240, borderRadius: 8, background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 56, fontWeight: 700 }}>
              {person.name.charAt(0)}
            </div>
          )}

          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.3 }}>
              {person.name}
            </h1>
            {role && (
              <div style={{ fontSize: 14, color: 'var(--fm-accent)', fontWeight: 600, marginBottom: 8 }}>
                {role}
              </div>
            )}
            {person.also_known_as.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 8 }}>
                {t('publicPerson.alsoKnownAs', { names: person.also_known_as.slice(0, 3).join(' / ') })}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--fm-text-sub)' }}>
              {person.birthday && <div>{t('publicPerson.birthday', { date: `${person.birthday}${person.deathday ? ` 〜 ${person.deathday}` : ''}` })}</div>}
              {person.place_of_birth && <div>{t('publicPerson.birthplace', { place: person.place_of_birth })}</div>}
              {(person.director_works.length > 0 || person.writer_works.length > 0 || person.cast.length > 0) && (
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {person.director_works.length > 0 && <span>{t('publicPerson.directorCount', { n: person.director_works.length })}</span>}
                  {person.writer_works.length > 0 && <span>{t('publicPerson.writerCount', { n: person.writer_works.length })}</span>}
                  {person.cast.length > 0 && <span>{t('publicPerson.actorCount', { n: person.cast.length })}</span>}
                </div>
              )}
              {reviewStats.count > 0 && reviewStats.avg != null && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--fm-star)', fontWeight: 700 }}>★ {reviewStats.avg.toFixed(1)}</span>
                  <span style={{ color: 'var(--fm-text-muted)', marginLeft: 6 }}>
                    {t('publicPerson.filmoRatingSuffix', { count: reviewStats.count })}
                  </span>
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <PersonAddWorkTrigger
                  personId={person.id}
                  personName={person.name}
                  profilePath={person.profile_path}
                  role={
                    person.known_for_department === 'Acting' ? 'cast'
                    : person.known_for_department === 'Writing' ? 'writer'
                    : 'director'
                  }
                />
                <PersonEditProposalTrigger
                  personId={person.id}
                  current={{
                    name: person.name,
                    biography: person.biography,
                    birthday: person.birthday,
                    place_of_birth: person.place_of_birth,
                    homepage: person.homepage,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {person.biography && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>{t('publicPerson.biographyHeading')}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--fm-text-sub)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {person.biography}
            </p>
          </section>
        )}

        {person.external_links.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>{t('publicPerson.linksHeading')}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {person.external_links.map(l => (
                <a
                  key={l.key}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer me"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 999,
                    background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
                    color: 'var(--fm-text)', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <ExternalIcon type={l.key} />
                  {l.key === 'homepage' ? t('publicPerson.officialSite') : l.label}
                </a>
              ))}
            </div>
          </section>
        )}

        {person.director_works.length > 0 && (
          <CreditSection title={t('publicPerson.directorWorksHeading')} works={person.director_works} />
        )}
        {person.writer_works.length > 0 && (
          <CreditSection title={t('publicPerson.writerWorksHeading')} works={person.writer_works} />
        )}
        {person.cast.length > 0 && (
          <CreditSection title={t('publicPerson.castWorksHeading')} works={person.cast.slice(0, 24)} />
        )}

        <PersonReviewsSection
          personName={person.name}
          reviews={reviews}
          stats={reviewStats}
          t={t}
        />

        {/* 未ログイン: サインアップ誘導 */}
        <AuthGate hideWhenAuthed>
          <section style={{
            marginTop: 32, padding: 24, borderRadius: 12,
            background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
            textAlign: 'center',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>
              {t('publicPerson.ctaPanelHeading', { name: person.name })}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: '0 0 16px' }}>
              {t('publicPerson.ctaPanelSub')}
            </p>
            <Link href="/" style={{
              display: 'inline-block', padding: '10px 28px', borderRadius: 8,
              background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
            }}>
              {t('publicPerson.ctaStart')}
            </Link>
          </section>
        </AuthGate>
      </div>

      {/* ログイン済み: sticky ボトムバー */}
      <OpenInAppBar
        href={`/?person=${person.id}`}
        label={t('publicPerson.stickyLabel')}
      />
    </div>
  )
}

/** SNS / 外部リンク用のシンプルな emoji 風アイコン。
 *  React Native との依存ライブラリを増やしたくないので絵文字で代用。 */
function ExternalIcon({ type }: { type: string }) {
  const map: Record<string, string> = {
    x: '𝕏',
    instagram: '📸',
    tiktok: '🎵',
    youtube: '▶︎',
    facebook: 'f',
    imdb: '🎬',
    wikidata: '📖',
    homepage: '🌐',
  }
  const ch = map[type] || '🔗'
  return (
    <span aria-hidden="true" style={{
      width: 16, height: 16, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: type === 'x' ? 14 : 13,
      lineHeight: 1,
    }}>
      {ch}
    </span>
  )
}

function PersonReviewsSection({
  personName,
  reviews,
  stats,
  t,
}: {
  personName: string
  reviews: PublicPersonReview[]
  stats: PersonReviewStats
  t: ServerT
}) {
  const hasReviews = reviews.length > 0
  return (
    <section style={{ marginTop: 36, marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          {t('publicPerson.reviewsHeading', { name: personName })}
          {stats.count > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--fm-text-muted)', fontWeight: 500 }}>
              {t('publicPerson.reviewsCount', { count: stats.count })}
            </span>
          )}
        </h2>
        {stats.count > 0 && stats.avg != null && (
          <span style={{ fontSize: 14, color: 'var(--fm-star)', fontWeight: 700 }}>
            ★ {stats.avg.toFixed(1)}
          </span>
        )}
      </div>

      {!hasReviews ? (
        <div style={{
          padding: 24, borderRadius: 10,
          background: 'var(--fm-bg-card)', border: '1px dashed var(--fm-border)',
          textAlign: 'center', color: 'var(--fm-text-muted)', fontSize: 13,
        }}>
          {t('publicPerson.noReviewsLine1')}<br />
          {t('publicPerson.noReviewsLine2')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reviews.map(r => (
            <article key={r.id} style={{
              padding: 14, borderRadius: 10,
              background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
            }}>
              <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {r.user_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.user_avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fm-bg-secondary)' }} />
                )}
                <div style={{ flex: 1 }}>
                  <Link href={`/u/${r.user_id}`} style={{ color: 'var(--fm-text)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    {r.user_name}
                  </Link>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 1 }}>
                    {r.created_at.slice(0, 10)}
                  </div>
                </div>
                {r.score != null && (
                  <span style={{ fontSize: 13, color: 'var(--fm-star)', fontWeight: 700 }}>
                    ★ {r.score.toFixed(1)}
                  </span>
                )}
              </header>
              {r.body && (
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--fm-text-sub)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {r.body}
                </p>
              )}
              {r.likes_count > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  ♥ {r.likes_count}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function CreditSection({ title, works }: { title: string; works: CombinedCredit[] }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12 }}>
        {works.map(w => {
          const path = w.media_type === 'tv' ? 'tv' : 'movies'
          const year = (w.release_date || w.first_air_date || '').slice(0, 4)
          const titleText = w.title || w.name || ''
          return (
            <Link
              key={`${w.media_type}-${w.id}`}
              href={`/${path}/${w.id}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              {w.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${TMDB_IMG}/w300${w.poster_path}`} alt={titleText}
                  loading="lazy"
                  style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: 6 }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '2/3', background: 'var(--fm-bg-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎬</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>{titleText}</div>
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>
                {year}{w.character ? ` ・ ${w.character}` : ''}{w.job && w.job !== 'Director' && w.department !== 'Acting' ? ` ・ ${w.job}` : ''}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
