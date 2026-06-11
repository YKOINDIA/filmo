import type { Metadata } from 'next'
import { Fable5Shell, Fable5SectionTitle, PolicyCard, PriorityRanking, type Policy } from '../ui'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: '日本国民が幸せになる『現実的な』政策 — Filmo Fable 5',
  description: 'AI(Claude Fable 5)が考えた、日本国民の幸福度を底上げする6つの現実的な政策提言。勤務間インターバル義務化、年収の壁の解消、義務教育の完全無償化など、実現可能性つきでわかりやすく解説。',
  openGraph: {
    type: 'article',
    title: '日本国民が幸せになる『現実的な』政策 — Filmo Fable 5',
    description: '幸福度を底上げする6つの現実的な政策提言。実現可能性・インパクト・コストを見える化。',
    url: `${APP_URL}/fable5/happiness`,
    siteName: 'Filmo',
  },
}

/* ------------------------------------------------------------------ */
/* 幸福の4資本 — 政策の土台になる考え方                                 */
/* ------------------------------------------------------------------ */

const FOUR_CAPITALS = [
  { emoji: '⏰', label: '可処分時間', desc: '自分のために使える時間', color: '#7cc4ff' },
  { emoji: '💴', label: '可処分所得', desc: '自由に使えるお金', color: '#ffd24a' },
  { emoji: '🤝', label: 'つながり', desc: '孤独でないこと', color: '#ff7aae' },
  { emoji: '🛡️', label: '安心', desc: '将来への不安が小さいこと', color: '#4fd1a5' },
]

/* ------------------------------------------------------------------ */
/* 政策リスト                                                          */
/* ------------------------------------------------------------------ */

const POLICIES: Policy[] = [
  {
    emoji: '🕰️',
    title: '勤務間インターバル11時間の義務化',
    what: '退勤から次の出勤まで最低11時間空けることを、努力義務から法的義務に格上げする(EU基準と同じ)。',
    why: '2019年から既に努力義務として法律に存在し、導入企業の運用ノウハウも蓄積済み。新しい仕組みを作るのではなく「努力義務→義務」の一段階だけ。EU全域で何十年も運用されている実績がある。',
    effect: '睡眠時間の確保は幸福度・健康・生産性すべての土台。長時間労働の「物理的な上限」ができ、過労死・メンタル不調の予防に直結する。',
    term: '短期 1〜2年',
    feasibility: 4,
    impact: 5,
    cost: 1,
    accent: 'rgba(124,196,255,0.45)',
  },
  {
    emoji: '💴',
    title: '「年収の壁」をクリフからスロープへ',
    what: '106万・130万円を超えた瞬間に手取りが急減する「崖」を、保険料が段階的に増える「坂」に変える。',
    why: '壁の存在自体が問題だという認識は与野党で既に一致しており、時限的な助成パッケージも実施済み。制度設計の選択肢(段階保険料・給付付き税額控除)も研究され尽くしている。あとは恒久制度化の決断だけ。',
    effect: '働き控えの解消で世帯収入が増え、人手不足も緩和。「働いたら損」という理不尽さの解消は公平感=幸福感に直結する。',
    term: '短期 2〜3年',
    feasibility: 4,
    impact: 5,
    cost: 3,
    accent: 'rgba(255,210,74,0.45)',
  },
  {
    emoji: '🏫',
    title: '義務教育の完全無償化(給食費・教材費ゼロ)',
    what: '公立小中学校の給食費・教材費・修学旅行積立などの保護者負担を国費でゼロにする。',
    why: '給食費無償化は既に約4割の自治体が独自財源で先行実施しており、効果も運用方法も実証済み。全国展開に必要な額は年5,000億円規模で、国家予算全体から見て実行可能なライン。',
    effect: '子育て世帯の固定費が確実に減り、自治体間の不公平も解消。「子どもを育てやすい国」という安心感は少子化対策の土台になる。',
    term: '短期 1〜2年',
    feasibility: 5,
    impact: 4,
    cost: 3,
    accent: 'rgba(255,122,174,0.45)',
  },
  {
    emoji: '🏠',
    title: '空き家900万戸を住宅市場に流す',
    what: '全国約900万戸の空き家を、空き家バンクの全国統一プラットフォーム化・リノベーション減税・解体費補助で流通させる。',
    why: '相続登記の義務化(2024年施行済み)で所有者不明問題の出口は既にできた。新築を建てるより、あるものを直して使うほうが安く、建設業の人手不足とも相性がいい。先行自治体の成功例も多数。',
    effect: '住居費は人生最大の固定費。中古住宅の選択肢が増えれば家賃・取得費が下がり、地方移住のハードルも下がる。',
    term: '中期 3〜5年',
    feasibility: 3,
    impact: 3,
    cost: 2,
    accent: 'rgba(79,209,165,0.45)',
  },
  {
    emoji: '🧠',
    title: 'カウンセリングに保険を効かせる',
    what: '公認心理師によるカウンセリング(認知行動療法など)への保険適用を大幅に拡大し、薬に頼らない選択肢を増やす。',
    why: '公認心理師という国家資格は2017年に整備済みで、担い手は既に存在する。英国が同様の心理療法アクセス改革(NHS Talking Therapies)で成果を出しており、設計図を輸入できる。',
    effect: '「つらいときに気軽に相談できる」が当たり前になる。うつ・不安の早期対応は休職・離職を減らし、本人と周囲の幸福度を直接引き上げる。',
    term: '中期 3〜5年',
    feasibility: 3,
    impact: 5,
    cost: 3,
    accent: 'rgba(162,155,254,0.45)',
  },
  {
    emoji: '📱',
    title: 'ライフイベント手続きのワンストップ化',
    what: '引越し・出産・死亡(相続)などの行政手続きを、マイナポータルから1回の入力で完結させる。',
    why: 'マイナンバーという基盤は既に全国民に行き渡り、引越しワンストップは一部開始済み。残りは省庁・自治体システムの接続という「実装の問題」で、デンマークなど完成形の手本もある。',
    effect: '人生で最も大変な時期の「役所めぐりストレス」が消える。行政側も窓口コストが減り、浮いた人員を対人支援に回せる。',
    term: '短期〜中期 2〜4年',
    feasibility: 4,
    impact: 3,
    cost: 3,
    accent: 'rgba(108,242,255,0.45)',
  },
]

/* おすすめ度 = インパクト × 実現可能性 ÷ コスト を 100 点満点に正規化 */
const RANKING = [
  { label: '勤務間インターバル義務化', emoji: '🕰️', score: 100 },
  { label: '義務教育の完全無償化', emoji: '🏫', score: 78 },
  { label: '年収の壁の解消', emoji: '💴', score: 70 },
  { label: 'カウンセリング保険適用', emoji: '🧠', score: 58 },
  { label: '空き家の市場流通', emoji: '🏠', score: 48 },
  { label: '手続きワンストップ化', emoji: '📱', score: 44 },
]

export default function HappinessPolicyPage() {
  return (
    <Fable5Shell
      title="日本国民が幸せになる『現実的な』政策"
      emoji="😊"
      accent="rgba(255,122,174,0.35)"
    >
      <div style={{ padding: '0 20px' }}>
        {/* リード文 */}
        <section style={{ paddingTop: 20 }}>
          <div style={{
            borderRadius: 16,
            padding: '18px 18px',
            background: 'linear-gradient(135deg, rgba(255,122,174,0.15), rgba(255,210,74,0.08))',
            border: '1px solid rgba(255,122,174,0.3)',
            fontSize: 13, color: '#ddd', lineHeight: 1.8,
          }}>
            日本のGDPは世界トップクラスなのに、幸福度ランキングは毎年50位前後。
            足りないのはお金そのものより、<strong style={{ color: '#ff9ec4' }}>時間・手取り・つながり・安心</strong>の4つです。
            ここでは「明日から法案を書ける」レベルの現実的な政策だけを6つ選びました。
          </div>
        </section>

        {/* 幸福の4資本 */}
        <Fable5SectionTitle emoji="🧭" label="考え方 — 幸福の4資本" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {FOUR_CAPITALS.map(c => (
            <div key={c.label} style={{
              padding: '14px 12px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: `1px solid ${c.color}55`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{c.emoji}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: c.color }}>{c.label}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 10, lineHeight: 1.6 }}>
          6つの政策はすべて、この4資本のどれかを直接増やすものだけを選んでいます。
        </div>

        {/* 政策カード */}
        <Fable5SectionTitle emoji="📜" label="6つの政策提言" />
        <div style={{ display: 'grid', gap: 14 }}>
          {POLICIES.map((p, i) => (
            <PolicyCard key={p.title} policy={p} index={i} />
          ))}
        </div>

        {/* おすすめ度ランキング */}
        <Fable5SectionTitle emoji="🏆" label="まずやるべき順(総合おすすめ度)" />
        <PriorityRanking items={RANKING} barColor="#ff7aae" />

        {/* まとめ */}
        <Fable5SectionTitle emoji="💡" label="まとめ" />
        <div style={{
          borderRadius: 16,
          padding: '18px 18px',
          background: 'rgba(20,22,40,0.7)',
          border: '1px solid rgba(255,210,74,0.3)',
          fontSize: 13, color: '#ddd', lineHeight: 1.9,
        }}>
          最優先は<strong style={{ color: '#7cc4ff' }}>「時間」</strong>。
          勤務間インターバルの義務化はほぼコストゼロで、睡眠という幸福の土台を全国民に返します。
          次に<strong style={{ color: '#ffd24a' }}>「手取り」</strong>を年収の壁の解消と教育無償化で増やし、
          <strong style={{ color: '#ff9ec4' }}>「つながりと安心」</strong>をメンタルケアの保険適用で支える。
          どれも新発明は不要で、既にある制度のネジを締め直すだけ。
          だからこそ『現実的』です。
        </div>

        <div style={{ fontSize: 10.5, color: '#666', marginTop: 20, lineHeight: 1.7, textAlign: 'center' }}>
          本ページはAI(Claude Fable 5)による提言です。数値・制度は2026年6月時点の情報に基づきます。<br />
          特定の政党・団体とは関係ありません。
        </div>
      </div>
    </Fable5Shell>
  )
}
