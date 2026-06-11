import type { Metadata } from 'next'
import { Fable5Shell, Fable5SectionTitle, PolicyCard, PriorityRanking, type Policy } from '../ui'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: '日本が最強になる『現実的な』政策 — Filmo Fable 5',
  description: 'AI(Claude Fable 5)が考えた、日本の国力を底上げする7つの現実的な政策提言。エネルギー自給、博士人材、半導体、コンテンツ輸出など、実現可能性つきでわかりやすく解説。',
  openGraph: {
    type: 'article',
    title: '日本が最強になる『現実的な』政策 — Filmo Fable 5',
    description: '国力の五角形を埋める7つの現実的な政策提言。実現可能性・インパクト・コストを見える化。',
    url: `${APP_URL}/fable5/strongest`,
    siteName: 'Filmo',
  },
}

/* ------------------------------------------------------------------ */
/* 国力の五角形 — レーダーチャート(静的SVG)                            */
/* 軸: エネルギー / 技術力 / 人材 / 食料 / 文化発信力                    */
/* ------------------------------------------------------------------ */

function NationalPowerRadar() {
  return (
    <div style={{
      borderRadius: 16,
      padding: '18px 8px 10px',
      background: 'rgba(20,22,40,0.7)',
      border: '1px solid rgba(124,196,255,0.3)',
    }}>
      <svg viewBox="-20 10 320 262" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 360, display: 'block', margin: '0 auto' }}>
        {/* グリッド(33% / 66% / 100%) */}
        <polygon points="140,107 171.4,129.8 159.4,166.7 120.6,166.7 108.6,129.8" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <polygon points="140,74 202.8,119.6 178.8,193.4 101.2,193.4 77.2,119.6" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <polygon points="140,40 235.1,109.1 198.8,220.9 81.2,220.9 44.9,109.1" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
        {/* 軸線 */}
        <line x1="140" y1="140" x2="140" y2="40" stroke="rgba(255,255,255,0.08)" />
        <line x1="140" y1="140" x2="235.1" y2="109.1" stroke="rgba(255,255,255,0.08)" />
        <line x1="140" y1="140" x2="198.8" y2="220.9" stroke="rgba(255,255,255,0.08)" />
        <line x1="140" y1="140" x2="81.2" y2="220.9" stroke="rgba(255,255,255,0.08)" />
        <line x1="140" y1="140" x2="44.9" y2="109.1" stroke="rgba(255,255,255,0.08)" />

        {/* 目標(7つの政策実行後のイメージ) */}
        <polygon
          points="140,50 225.6,112.2 192.9,212.8 87.1,212.8 54.4,112.2"
          fill="rgba(124,196,255,0.10)" stroke="#7cc4ff" strokeWidth="1.5" strokeDasharray="5 4"
        />
        {/* 現在(AIによる相対評価) */}
        <polygon
          points="140,110 201.8,119.9 169.4,180.5 116.5,172.4 63.9,115.3"
          fill="rgba(255,87,87,0.18)" stroke="#ff5757" strokeWidth="1.5"
        />

        {/* 軸ラベル */}
        <text x="140" y="30" textAnchor="middle" fill="#cfc6e0" fontSize="11" fontWeight="700">エネルギー</text>
        <text x="243" y="105" textAnchor="start" fill="#cfc6e0" fontSize="11" fontWeight="700">技術力</text>
        <text x="203" y="238" textAnchor="middle" fill="#cfc6e0" fontSize="11" fontWeight="700">人材</text>
        <text x="77" y="238" textAnchor="middle" fill="#cfc6e0" fontSize="11" fontWeight="700">食料</text>
        <text x="38" y="105" textAnchor="end" fill="#cfc6e0" fontSize="11" fontWeight="700">文化発信力</text>
      </svg>

      {/* 凡例 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, padding: '8px 0 6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#ccc' }}>
          <span style={{ width: 14, height: 3, background: '#ff5757', borderRadius: 2, display: 'inline-block' }} />
          現在の日本
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#ccc' }}>
          <span style={{ width: 14, height: 3, background: '#7cc4ff', borderRadius: 2, display: 'inline-block', backgroundImage: 'linear-gradient(90deg, #7cc4ff 60%, transparent 60%)', backgroundSize: '5px 3px' }} />
          7つの政策実行後の目標
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#777', textAlign: 'center', paddingBottom: 6 }}>
        ※ AIによる相対評価のイメージ図。文化発信力は既に世界最強クラス
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 政策リスト                                                          */
/* ------------------------------------------------------------------ */

const POLICIES: Policy[] = [
  {
    emoji: '⚡',
    title: 'エネルギー自給率を13%から倍増させる',
    what: '安全審査をクリアした原発の着実な再稼働と、日本発のペロブスカイト太陽電池(軽くて曲がる次世代型)の量産支援を二本柱にする。',
    why: '新技術の発明は不要。再稼働は審査制度がすでに回っており、ペロブスカイトは日本人が発明し、主原料のヨウ素は日本が世界シェア2位。ビルの壁面に貼れるため、平地が少ない日本の弱点を逆手に取れる。',
    effect: 'エネルギーは国力の土台で、最大の弱点。自給率が上がれば電気代・産業競争力・安全保障のすべてが同時に改善する。',
    term: '中期 3〜7年',
    feasibility: 4,
    impact: 5,
    cost: 4,
    accent: 'rgba(255,210,74,0.45)',
  },
  {
    emoji: '🎓',
    title: '博士人材を「使い倒す」国にする',
    what: '博士課程学生への生活費相当支援(SPRING事業)を恒久化し、博士を採用した企業に税制優遇を設ける。',
    why: '支援事業はすでに存在し、効果検証も済んでいる。「時限事業→恒久制度」と「採用側へのインセンティブ追加」だけで、新しい役所も法律の大改正も不要。',
    effect: '人口減の日本が技術で勝つには、研究者の頭数と待遇が生命線。「博士に進むと損」という世界的に異常な状態を解消し、頭脳流出を止める。',
    term: '短期 1〜2年',
    feasibility: 5,
    impact: 4,
    cost: 2,
    accent: 'rgba(162,155,254,0.45)',
  },
  {
    emoji: '💾',
    title: '半導体投資を一過性で終わらせない',
    what: 'TSMC熊本・Rapidus北海道への支援を単発の補助金で終わらせず、電力・水・道路・人材育成をセットにした10年単位の産業集積計画に格上げする。',
    why: '工場誘致はすでに成功し、熊本では地価・賃金が上昇するなど経済効果が実証済み。ゼロから始める話ではなく「続けるかどうか」の意思決定の問題。',
    effect: '半導体はAI時代の石油。製造拠点が国内にあること自体が外交カードになり、地方に高賃金の雇用が生まれる。',
    term: '長期 5〜10年',
    feasibility: 4,
    impact: 5,
    cost: 5,
    accent: 'rgba(124,196,255,0.45)',
  },
  {
    emoji: '🌏',
    title: '高度外国人材の獲得競争に本気で参入する',
    what: '高度人材向け優遇制度(J-Skip/J-Find)を入口に、英語で完結する行政手続き・医療・子どもの教育インフラを整備し、「来てから困らない国」にする。',
    why: '制度の入口はすでに2023年から存在する。足りないのは生活インフラの英語対応という地味な実装で、巨額の予算より自治体・病院・学校の運用改善が主役。',
    effect: '人口減少下で国力を保つ唯一の即効薬。世界の研究者・エンジニアの獲得競争で、円安の今は「日本で働きたい」需要を取り込むチャンス。',
    term: '中期 3〜5年',
    feasibility: 3,
    impact: 4,
    cost: 3,
    accent: 'rgba(79,209,165,0.45)',
  },
  {
    emoji: '🎬',
    title: 'コンテンツを「第二の自動車産業」に育てる',
    what: 'アニメ・ゲーム・映画の海外展開(すでに年5兆円規模)を国家戦略に格上げ。制作現場の待遇改善、海賊版対策、翻訳・配信支援に集中投資する。',
    why: '需要はすでに世界が証明済みで、作る側の供給体制が追いついていないだけ。韓国がK-POP・ドラマで国策として成功させた手本があり、日本のIP資産はそれを上回る。',
    effect: '輸出額で鉄鋼や半導体素材に並ぶ産業に成長余地。文化の影響力は安全保障にも効く「最強のソフトパワー」になる。',
    term: '短期〜中期 2〜5年',
    feasibility: 4,
    impact: 4,
    cost: 2,
    accent: 'rgba(255,122,174,0.45)',
  },
  {
    emoji: '🚜',
    title: '農業を「守る」から「攻める」へ',
    what: '農地の集約とスマート農業(自動運転トラクター・ドローン)への転換支援で生産性を上げ、和牛・日本酒・果物の輸出をさらに伸ばす。',
    why: '農産物・食品の輸出は過去10年で約3倍に伸びており、勝ちパターンは実証済み。高齢農家の大量リタイアは、見方を変えれば農地集約の歴史的チャンス。',
    effect: '食料自給率という安全保障の弱点を緩和しつつ、農業を若者が選ぶ「稼げる産業」に変える。地方経済の柱にもなる。',
    term: '中期 3〜7年',
    feasibility: 3,
    impact: 3,
    cost: 3,
    accent: 'rgba(108,242,255,0.45)',
  },
  {
    emoji: '🛡️',
    title: '防衛産業にスタートアップを呼び込む',
    what: '増額が決まった防衛費の調達先を大手数社に限定せず、ドローン・宇宙・サイバー分野のスタートアップが参入できる調達制度に変える。',
    why: '予算はすでに確保されており、変えるのは「使い方」だけ。米国がスタートアップ調達(DIU)で成功した設計図があり、ウクライナでドローンの有効性も実証された。',
    effect: '同じ予算で防衛力と産業育成の一石二鳥。軍事技術の民間転用(GPSやインターネットが好例)で経済全体に波及する。',
    term: '中期〜長期 3〜8年',
    feasibility: 3,
    impact: 4,
    cost: 3,
    accent: 'rgba(255,87,87,0.45)',
  },
]

/* おすすめ度 = インパクト × 実現可能性 ÷ コスト を 100 点満点に正規化 */
const RANKING = [
  { label: '博士人材の処遇改革', emoji: '🎓', score: 100 },
  { label: 'コンテンツ産業の輸出強化', emoji: '🎬', score: 80 },
  { label: 'エネルギー自給率の倍増', emoji: '⚡', score: 50 },
  { label: '高度外国人材の獲得', emoji: '🌏', score: 40 },
  { label: '半導体産業集積の継続', emoji: '💾', score: 40 },
  { label: '防衛スタートアップ調達', emoji: '🛡️', score: 40 },
  { label: '攻めの農業への転換', emoji: '🚜', score: 30 },
]

export default function StrongestPolicyPage() {
  return (
    <Fable5Shell
      title="日本が最強になる『現実的な』政策"
      emoji="🗻"
      accent="rgba(124,196,255,0.35)"
    >
      <div style={{ padding: '0 20px' }}>
        {/* リード文 */}
        <section style={{ paddingTop: 20 }}>
          <div style={{
            borderRadius: 16,
            padding: '18px 18px',
            background: 'linear-gradient(135deg, rgba(124,196,255,0.15), rgba(255,87,87,0.08))',
            border: '1px solid rgba(124,196,255,0.3)',
            fontSize: 13, color: '#ddd', lineHeight: 1.8,
          }}>
            「最強の国」とは軍事力だけの話ではありません。
            <strong style={{ color: '#7cc4ff' }}>エネルギー・技術力・人材・食料・文化発信力</strong>の
            五角形が大きい国こそ、誰にも依存せず、世界から尊敬される国。
            日本は文化発信力が既に世界最強クラスである一方、エネルギーが極端に弱い。
            この凸凹を埋める7つの政策を選びました。
          </div>
        </section>

        {/* 国力の五角形 */}
        <Fable5SectionTitle emoji="🛰️" label="現状分析 — 国力の五角形" />
        <NationalPowerRadar />

        {/* 政策カード */}
        <Fable5SectionTitle emoji="📜" label="7つの政策提言" />
        <div style={{ display: 'grid', gap: 14 }}>
          {POLICIES.map((p, i) => (
            <PolicyCard key={p.title} policy={p} index={i} />
          ))}
        </div>

        {/* おすすめ度ランキング */}
        <Fable5SectionTitle emoji="🏆" label="まずやるべき順(総合おすすめ度)" />
        <PriorityRanking items={RANKING} barColor="#7cc4ff" />

        {/* まとめ */}
        <Fable5SectionTitle emoji="💡" label="まとめ" />
        <div style={{
          borderRadius: 16,
          padding: '18px 18px',
          background: 'rgba(20,22,40,0.7)',
          border: '1px solid rgba(255,210,74,0.3)',
          fontSize: 13, color: '#ddd', lineHeight: 1.9,
        }}>
          即効性で選ぶなら<strong style={{ color: '#a29bfe' }}>「博士人材」</strong>と
          <strong style={{ color: '#ff9ec4' }}>「コンテンツ輸出」</strong>。
          どちらも低コストで、すでに世界が日本の実力を認めている分野です。
          土台の勝負は<strong style={{ color: '#ffd24a' }}>「エネルギー」</strong>と
          <strong style={{ color: '#7cc4ff' }}>「半導体」</strong>で、ここは10年単位の覚悟が要る。
          共通するのは、どれも<strong style={{ color: '#4fd1a5' }}>ゼロからの発明ではなく
          「すでに動いているものを本気で続ける」</strong>という選択だということ。
          最強への道は、意外と地味です。
        </div>

        <div style={{ fontSize: 10.5, color: '#666', marginTop: 20, lineHeight: 1.7, textAlign: 'center' }}>
          本ページはAI(Claude Fable 5)による提言です。数値・制度は2026年6月時点の情報に基づきます。<br />
          特定の政党・団体とは関係ありません。
        </div>
      </div>
    </Fable5Shell>
  )
}
