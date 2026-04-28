/**
 * 管理者メール一覧の共通定義。
 *
 * 環境変数 NEXT_PUBLIC_ADMIN_EMAILS (カンマ区切り) を優先。
 * 未設定なら DEFAULT_ADMINS にハードコードされた値を使う。
 *
 * 例 (.env.local / Vercel env):
 *   NEXT_PUBLIC_ADMIN_EMAILS=ykoindia@gmail.com,phmpt172@gmail.com
 *
 * 後方互換: 単一の NEXT_PUBLIC_ADMIN_EMAIL もまだ読む。
 */

const DEFAULT_ADMINS = [
  'ykoindia@gmail.com',
  'phmpt172@gmail.com',
] as const

function parseList(): string[] {
  const multi = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  if (multi && multi.trim()) {
    return multi.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }
  const single = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (single && single.trim()) {
    return [single.trim().toLowerCase()]
  }
  return [...DEFAULT_ADMINS] as string[]
}

export const ADMIN_EMAILS: string[] = parseList()

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
