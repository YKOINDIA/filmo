import type { Metadata } from 'next'
import { Fable5Shell, Fable5SectionTitle, Meter } from '../ui'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: 'SpaceXが世界を“無料”にする日 — Filmo Fable 5',
  description: 'SpaceXが宇宙太陽光発電・AI・小惑星採掘を実用化し、電力・ネット・自動運転・配送ロボットを無料開放したら世界はどう変わるのか。戦争・労働・政治が消え、人類が「どう生きるか」に没頭する未来シナリオをAIが整理しました。',
  openGraph: {
    type: 'article',
    title: 'SpaceXが世界を“無料”にする日 — Filmo Fable 5',
    description: '宇宙太陽光・AI・小惑星採掘が実現する『欠乏なき世界』。戦争も労働も消える未来シナリオを見える化。',
    url: `${APP_URL}/fable5/spacex`,
    siteName: 'Filmo',
  },
}

/* ------------------------------------------------------------------ */
/* 3つの技術ブレイクスルー                                              */
/* ------------------------------------------------------------------ */

const BREAKTHROUGHS = [
  {
    emoji: '☀️',
    title: '宇宙太陽光発電',
    desc: '天候も夜も関係なく、軌道上で発電して地上へ送電。枯渇しないクリーン電力の源泉。',
    unlock: '解放されるもの: 電力',
    color: '#ffd24a',
  },
  {
    emoji: '🧠',
    title: 'AI',
    desc: '生産・物流・運転・配送のすべてを自動化する頭脳。人間の労働を肩代わりする。',
    unlock: '解放されるもの: 労働',
    color: '#a29bfe',
  },
  {
    emoji: '🪨',
    title: '小惑星採掘',
    desc: '地球を掘らずに、宇宙から金属・レアメタルを無尽蔵に調達。資源の奪い合いが無意味になる。',
    unlock: '解放されるもの: 資源',
    color: '#7cc4ff',
  },
]

/* ------------------------------------------------------------------ */
/* 無料開放されるインフラ                                               */
/* ------------------------------------------------------------------ */

const FREE_INFRA = [
  { emoji: '⚡', label: '電力', desc: '宇宙太陽光から無限供給' },
  { emoji: '📡', label: 'ネット', desc: '衛星網で地球全域カバー' },
  { emoji: '🚗', label: '自動運転車', desc: '呼べば来る、誰でも乗れる' },
  { emoji: '📦', label: '配送ロボット', desc: '物資が自動で行き渡る' },
]

/* ------------------------------------------------------------------ */
/* 連鎖反応 — 世界が変わる8ステップ                                     */
/* ------------------------------------------------------------------ */

const CHAIN: { emoji: string; title: string; desc: string }[] = [
  {
    emoji: '🛰️',
    title: '3つの技術が実用化される',
    desc: '宇宙太陽光発電・AI・小惑星採掘。エネルギー、労働、資源の3つの「欠乏」が同時に終わる。',
  },
  {
    emoji: '🆓',
    title: 'インフラの無料開放',
    desc: '環境に優しい電力・ネット・自動運転車・配送ロボットが、誰でもタダで使えるようになる。',
  },
  {
    emoji: '🕊️',
    title: '戦争の消滅',
    desc: '資源も仕事も奪い合う理由がなくなり、戦争の動機そのものが消える。地球の自然破壊も止まる。',
  },
  {
    emoji: '🤖',
    title: '労働・企業・政治が役目を終える',
    desc: '全自動で物資が行き渡るため、生存のための労働も、企業活動も、予算を巡る政治も不要になる。',
  },
  {
    emoji: '🍣',
    title: '宇宙食料工場の稼働',
    desc: '細胞培養と宇宙養殖で、新鮮な刺身や高級ステーキ肉までタダ同然で大量生産。美食の民主化。',
  },
  {
    emoji: '🔴',
    title: '火星移住と宇宙市場の誕生',
    desc: '目論見書にある「火星への移住計画」と連動し、市場は地球を超えて宇宙規模へ拡大する。',
  },
  {
    emoji: '👑',
    title: '国家と大企業が主役を降りる',
    desc: '「足りないものを管理・分配する」存在だった国家と大企業は、欠乏の消滅とともに主役の座を失う。',
  },
  {
    emoji: '🧠',
    title: '究極の自由時代へ',
    desc: '人間は「生存のための労働」から解放され、「どう生きるか」が人生最大のテーマになる。',
  },
]

/* ------------------------------------------------------------------ */
/* ビフォー → アフター                                                  */
/* ------------------------------------------------------------------ */

const TRANSFORMS = [
  { before: '生存のための労働', after: '好きな表現活動', emoji: '🎨' },
  { before: '資源を奪い合う戦争', after: '火星開拓という共同プロジェクト', emoji: '🚀' },
  { before: '予算を巡る政治', after: '「どう生きるか」の哲学議論', emoji: '💭' },
  { before: '地球を削る大量生産', after: '宇宙工場と自然の回復', emoji: '🌏' },
  { before: '一部の人の高級グルメ', after: '誰でも味わえる刺身とステーキ', emoji: '🥩' },
]

/* ------------------------------------------------------------------ */
/* Fable 5 現実度チェック                                               */
/* ------------------------------------------------------------------ */

const REALITY_CHECK: { label: string; emoji: string; level: 1 | 2 | 3 | 4 | 5; note: string }[] = [
  {
    label: 'AIによる自動化',
    emoji: '🧠',
    level: 4,
    note: '8つの中で最速で進行中。生産・物流の自動化は既に現実の延長線上。',
  },
  {
    label: '完全自動運転',
    emoji: '🚗',
    level: 4,
    note: '無人タクシーは米中で商用運行済み。あとは展開スピードの問題。',
  },
  {
    label: '衛星ネット網',
    emoji: '📡',
    level: 4,
    note: 'Starlinkで技術は完成済み。「無料化」だけが残された壁。',
  },
  {
    label: '細胞培養肉',
    emoji: '🥩',
    level: 3,
    note: 'シンガポール・米国で販売認可済み。課題は価格だが、量産技術は進化中。',
  },
  {
    label: '宇宙太陽光発電',
    emoji: '☀️',
    level: 2,
    note: '日米で送電実証は成功済み。打ち上げコスト低下(Starship)が成否を握る。',
  },
  {
    label: '小惑星採掘',
    emoji: '🪨',
    level: 2,
    note: 'はやぶさ2のサンプルリターンで往復技術は実証済み。商業化はこれから。',
  },
  {
    label: '火星移住',
    emoji: '🔴',
    level: 2,
    note: 'Starshipの開発と試験飛行が進行中。移住は数十年単位の挑戦。',
  },
  {
    label: '「無料開放」という決断',
    emoji: '🆓',
    level: 1,
    note: '技術より難しいのは経済と人間の合意。実はシナリオ最大のボトルネック。',
  },
]

export default function SpacexScenarioPage() {
  return (
    <Fable5Shell
      title="SpaceXが世界を“無料”にする日"
      emoji="🚀"
      accent="rgba(108,242,255,0.35)"
    >
      <div style={{ padding: '0 20px' }}>
        {/* リード文 */}
        <section style={{ paddingTop: 20 }}>
          <div style={{
            borderRadius: 16,
            padding: '18px 18px',
            background: 'linear-gradient(135deg, rgba(108,242,255,0.13), rgba(255,87,87,0.08))',
            border: '1px solid rgba(108,242,255,0.3)',
            fontSize: 13, color: '#ddd', lineHeight: 1.8,
          }}>
            もしSpaceXが<strong style={{ color: '#6cf2ff' }}>宇宙太陽光発電・AI・小惑星採掘</strong>を実用化し、
            電力もネットも自動運転も配送ロボットも<strong style={{ color: '#ffd24a' }}>無料で開放</strong>したら——。
            戦争が消え、労働が消え、政治が消え、宇宙工場の刺身とステーキを楽しみながら
            「どう生きるか」を考える時代が来る。
            そんな<strong style={{ color: '#ff9ec4' }}>『欠乏なき世界』シナリオ</strong>を、
            連鎖反応の順番に整理して見える化しました。
          </div>
          <div style={{
            marginTop: 10, fontSize: 11, color: '#8a82a0', lineHeight: 1.6,
          }}>
            ※ 本ページは思考実験(未来シナリオ)です。『現実的な』政策シリーズとは違い、あえて大きく考えます。
          </div>
        </section>

        {/* 3つの技術 */}
        <Fable5SectionTitle emoji="🔑" label="すべての起点 — 3つの技術ブレイクスルー" />
        <div style={{ display: 'grid', gap: 10 }}>
          {BREAKTHROUGHS.map(b => (
            <div key={b.title} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: `1px solid ${b.color}55`,
            }}>
              <div style={{ fontSize: 30, flexShrink: 0 }}>{b.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: b.color }}>{b.title}</div>
                <div style={{ fontSize: 12, color: '#ccc', marginTop: 4, lineHeight: 1.6 }}>{b.desc}</div>
                <div style={{
                  display: 'inline-block', marginTop: 6,
                  fontSize: 10, fontWeight: 800, color: b.color,
                  background: `${b.color}18`,
                  border: `1px solid ${b.color}44`,
                  borderRadius: 4, padding: '2px 8px', letterSpacing: 0.5,
                }}>
                  {b.unlock}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 無料開放インフラ */}
        <Fable5SectionTitle emoji="🆓" label="無料開放される4つのインフラ" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {FREE_INFRA.map(f => (
            <div key={f.label} style={{
              padding: '14px 12px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: '1px solid rgba(79,209,165,0.4)',
              textAlign: 'center',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 8, right: 8,
                fontSize: 9, fontWeight: 900, color: '#0a0b14',
                background: '#4fd1a5', borderRadius: 4, padding: '2px 6px',
                letterSpacing: 0.5,
              }}>FREE</div>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{f.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#4fd1a5' }}>{f.label}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* 連鎖反応フロー */}
        <Fable5SectionTitle emoji="🌊" label="世界が変わる8つの連鎖反応" />
        <div style={{ position: 'relative' }}>
          {/* 縦のつなぎ線 */}
          <div style={{
            position: 'absolute', left: 21, top: 18, bottom: 18, width: 2,
            background: 'linear-gradient(180deg, #7cc4ff, #ff7aae, #ffd24a)',
            opacity: 0.35,
          }} />
          <div style={{ display: 'grid', gap: 12 }}>
            {CHAIN.map((step, i) => (
              <div key={step.title} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: 'rgba(20,22,40,0.95)',
                  border: '1px solid rgba(195,116,255,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, zIndex: 1,
                }}>
                  {step.emoji}
                </div>
                <div style={{
                  flex: 1, minWidth: 0,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'rgba(20,22,40,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#8a82a0', letterSpacing: 1 }}>
                    STEP {i + 1}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', marginTop: 2 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#ccc', marginTop: 5, lineHeight: 1.65 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ビフォー → アフター */}
        <Fable5SectionTitle emoji="🔁" label="人類のビフォー → アフター" />
        <div style={{
          display: 'grid', gap: 10,
          padding: '16px 16px', borderRadius: 16,
          background: 'rgba(20,22,40,0.7)',
          border: '1px solid rgba(255,122,174,0.3)',
        }}>
          {TRANSFORMS.map(t => (
            <div key={t.before} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{t.emoji}</span>
              <span style={{
                fontSize: 11.5, color: '#998', flex: 1,
                textDecoration: 'line-through', textDecorationColor: 'rgba(255,87,87,0.6)',
              }}>
                {t.before}
              </span>
              <span style={{ fontSize: 14, color: '#ffd24a', flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4fd1a5', flex: 1.2, lineHeight: 1.5 }}>
                {t.after}
              </span>
            </div>
          ))}
        </div>

        {/* 現実度チェック */}
        <Fable5SectionTitle emoji="🔬" label="Fable 5 現実度チェック" />
        <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, marginBottom: 12 }}>
          このシナリオ、ただの夢物語ではありません。部品ごとに見ると、すでに現実が追いかけている技術がいくつもあります。
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {REALITY_CHECK.map(r => (
            <div key={r.label} style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: '1px solid rgba(108,242,255,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{r.emoji}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', flex: 1 }}>{r.label}</span>
              </div>
              <Meter label="現実度" value={r.level} color="#6cf2ff" />
              <div style={{ fontSize: 11.5, color: '#bbb', marginTop: 8, lineHeight: 1.6 }}>
                {r.note}
              </div>
            </div>
          ))}
        </div>

        {/* まとめ */}
        <Fable5SectionTitle emoji="💡" label="まとめ — 最後に残る問い" />
        <div style={{
          borderRadius: 16,
          padding: '18px 18px',
          background: 'rgba(20,22,40,0.7)',
          border: '1px solid rgba(255,210,74,0.3)',
          fontSize: 13, color: '#ddd', lineHeight: 1.9,
        }}>
          このシナリオの面白さは、ボトルネックが<strong style={{ color: '#6cf2ff' }}>技術ではない</strong>ことです。
          AI・自動運転・衛星ネット・培養肉は既に現実が走り出していて、
          一番難しいのは<strong style={{ color: '#ffd24a' }}>「無料で開放する」という人間側の決断</strong>。
          つまりこれは宇宙の物語であると同時に、私たちの価値観の物語でもあります。
          そして欠乏が消えた世界で最後に残る問いは、ただひとつ——
          <strong style={{ color: '#ff9ec4' }}>「あなたは、どう生きるか」</strong>。
          映画と同じく、それを考えるのが一番楽しい時代になるのかもしれません。
        </div>

        <div style={{ fontSize: 10.5, color: '#666', marginTop: 20, lineHeight: 1.7, textAlign: 'center' }}>
          本ページはAI(Claude Fable 5)による未来シナリオの思考実験です。<br />
          SpaceX社・特定の企業・団体の公式見解とは関係ありません。
        </div>
      </div>
    </Fable5Shell>
  )
}
