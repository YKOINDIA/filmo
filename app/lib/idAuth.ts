// ============================================================
// ID + パスワードログイン: 共通ヘルパー
// ============================================================
// Supabase Auth はメール必須なので、ID ユーザーには
//   <username>@id.filmo.me
// という合成メールを発行する (Supabase 内部識別用、実送信なし)。

// 合成メールのドメイン。実 DNS は SPF/MX とも何も設定されておらず、
// 受信専用に作っていない。Supabase が「メール送信したつもり」になっても
// バウンスするだけで問題なし。
export const ID_EMAIL_DOMAIN = 'id.filmo.me'

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@${ID_EMAIL_DOMAIN}`
}

export function isIdEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${ID_EMAIL_DOMAIN}`)
}

// username 形式: 4-20 文字, 小文字英数字+アンダースコア
const USERNAME_REGEX = /^[a-z0-9_]{4,20}$/

export function isValidUsername(s: string): boolean {
  return USERNAME_REGEX.test(s)
}

// 予約語 (ID として使えない名前)
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'support', 'help',
  'filmo', 'official', 'staff', 'mod', 'moderator', 'owner',
  'null', 'undefined', 'anonymous', 'guest', 'user', 'test',
  'noreply', 'no_reply', 'postmaster', 'webmaster',
])

export function isReservedUsername(s: string): boolean {
  return RESERVED_USERNAMES.has(s.toLowerCase())
}

// パスワード強度 (最低限のチェック)
export function isValidPassword(s: string): boolean {
  return typeof s === 'string' && s.length >= 8 && s.length <= 100
}

// ─────────────────────────────────────────────────────────────
// 復旧コード生成 (12 文字、見間違いやすい字を除外)
// ─────────────────────────────────────────────────────────────
// 1/I/L、0/O は除く。残り 32 文字から 12 文字 → 約 60 bit エントロピー
const RECOVERY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * 12 文字の復旧コードを生成。表示は 4-4-4 区切り (例: XK7P-9M2A-4WQ8)。
 * 保存/比較は dash 無しで行う。
 */
export function generateRecoveryCode(): string {
  // ブラウザ/Node 両対応の crypto
  const arr = new Uint8Array(12)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < 12; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  let s = ''
  for (let i = 0; i < 12; i++) s += RECOVERY_CHARS[arr[i] % RECOVERY_CHARS.length]
  return s
}

/** 表示用に dash を入れる: XXXX-XXXX-XXXX */
export function formatRecoveryCode(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z2-9]/g, '')
  if (c.length !== 12) return code
  return `${c.slice(0,4)}-${c.slice(4,8)}-${c.slice(8,12)}`
}

/** 入力された復旧コードを正規化 (dash や空白を除去, 大文字化) */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, '')
}

/**
 * 復旧コードを sha256 でハッシュ化 (hex 64 文字)。
 * Web Crypto / Node crypto の両方で動く。
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code)
  const data = new TextEncoder().encode(normalized)
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}
