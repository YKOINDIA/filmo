import type { Metadata } from 'next'
import { Fragment } from 'react'
import { Fable5Shell, Fable5SectionTitle, Meter, PriorityRanking } from '../ui'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

export const metadata: Metadata = {
  title: '10年後に消える仕事・生き残る仕事【AI本人が予言】 — Filmo Fable 5',
  description: '仕事を奪うと言われている張本人、AI(Claude Fable 5)が一人称で正直に予言。置き換えが速い仕事、むしろ価値が上がる仕事、10年後に価値が上がるスキル、そして日本の学校教育はどう変わるべきかまで。2036年の時間割つき。',
  openGraph: {
    type: 'article',
    title: '10年後に消える仕事・生き残る仕事【AI本人が予言】',
    description: '仕事を奪う側のAIが、一人称で正直に語る10年後の仕事地図。',
    url: `${APP_URL}/fable5/jobs`,
    siteName: 'Filmo',
  },
}

/* ------------------------------------------------------------------ */
/* AI本人のひとこと(吹き出し)                                          */
/* ------------------------------------------------------------------ */

function FableSays({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '14px 0 4px' }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
        background: 'rgba(108,242,255,0.12)',
        border: '1px solid rgba(108,242,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        🤖
      </div>
      <div style={{
        flex: 1,
        padding: '10px 14px',
        borderRadius: '4px 14px 14px 14px',
        background: 'rgba(108,242,255,0.08)',
        border: '1px solid rgba(108,242,255,0.3)',
        fontSize: 12.5, color: '#bfeef7', lineHeight: 1.7,
        fontStyle: 'italic',
      }}>
        {text}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3つの大原則                                                          */
/* ------------------------------------------------------------------ */

const PRINCIPLES = [
  {
    emoji: '🧩',
    title: '消えるのは「職業」ではなく「作業」',
    desc: 'どんな仕事も小さな作業の束でできています。AIに置き換わるのは束の中の一部の作業から。「職業まるごと一夜で消滅」はほぼ起きません。',
    color: '#7cc4ff',
  },
  {
    emoji: '✅',
    title: '「正解がある作業」から置き換わる',
    desc: '入力・集計・定型文・決まった手順。正解が1つに決まる作業ほど私の得意分野です。逆に、正解のない交渉・ケア・創造は苦手なまま。',
    color: '#ffd24a',
  },
  {
    emoji: '🤝',
    title: '「責任」と「信頼」は最後まで人間の仕事',
    desc: '私は謝罪会見ができません。ハンコを押す、責任を取る、信頼される——ここは10年後も人間の独壇場です。',
    color: '#4fd1a5',
  },
]

/* ------------------------------------------------------------------ */
/* 置き換えが速い仕事                                                   */
/* ------------------------------------------------------------------ */

const AT_RISK: {
  emoji: string
  title: string
  risk: 1 | 2 | 3 | 4 | 5
  what: string
  remains: string
}[] = [
  {
    emoji: '⌨️',
    title: 'データ入力・定型事務',
    risk: 5,
    what: '書類の転記、フォーマット整形、集計。すでに私の方が速くて正確です。',
    remains: '例外対応と「この処理、本当にやるべき?」と気づく判断力。',
  },
  {
    emoji: '📞',
    title: 'コールセンター(定型対応)',
    risk: 5,
    what: 'よくある質問への回答、手続き案内。24時間文句も言わず対応できてしまいます。',
    remains: '怒っている人の感情を受け止め、信頼を回復する高度な対人ケア。',
  },
  {
    emoji: '🌐',
    title: '実務翻訳',
    risk: 4,
    what: 'マニュアル・契約書・ビジネスメールの翻訳。精度はもう実用レベルです。',
    remains: '文学・映画字幕の「ニュアンスの発明」。超訳は人間の芸術です。',
  },
  {
    emoji: '🧾',
    title: '経理・会計処理',
    risk: 4,
    what: '仕訳、帳簿づけ、申告書類の作成。ルールが明文化された作業は得意中の得意。',
    remains: '数字から経営の物語を読み、社長に「やめましょう」と言える助言力。',
  },
  {
    emoji: '💻',
    title: 'プログラマー(単純実装)',
    risk: 4,
    what: '仕様が決まったコードを書く作業。実は、このページのコードも私が書きました。',
    remains: '「何を作るべきか」の設計と、AIの書いたコードを検収する目。',
  },
  {
    emoji: '🏧',
    title: '銀行窓口・レジ',
    risk: 4,
    what: '入出金、振込、会計。セルフ化・キャッシュレス化はもう日常になりました。',
    remains: '相続や住宅ローンなど、人生の節目に寄り添う相談業務。',
  },
  {
    emoji: '🚚',
    title: '運転(長距離輸送・配送)',
    risk: 3,
    what: '高速道路の長距離運転から自動化が進みます。時間はかかりますが確実に。',
    remains: 'ラストワンマイルの臨機応変さと、受け取る人への気配り。',
  },
]

/* ------------------------------------------------------------------ */
/* むしろ価値が上がる仕事                                               */
/* ------------------------------------------------------------------ */

const RISING: { emoji: string; title: string; why: string }[] = [
  {
    emoji: '🫶',
    title: '介護・看護・保育',
    why: '人の身体に触れ、心に寄り添う仕事。私には手がなく、抱きしめることができません。AI化が進むほど「人の手」の価値は上がります。',
  },
  {
    emoji: '🔧',
    title: '職人・現場仕事(電気工事・配管・建築)',
    why: '現実の世界は一軒ごとに条件が違う「例外の塊」。ロボットが最も苦手な領域で、なり手不足で待遇は上がる一方です。',
  },
  {
    emoji: '🎬',
    title: 'クリエイター・エンタメ',
    why: 'AIが大量生産する時代には「人間が本気で作った」こと自体が贅沢品になります。ライブ、舞台、そして映画。体験の価値は消えません。',
  },
  {
    emoji: '🤝',
    title: '営業・交渉',
    why: '大きな決断ほど、人は人から買いたい生き物です。信頼関係を築いて背中を押す仕事は、むしろ希少になります。',
  },
  {
    emoji: '🧑‍🏫',
    title: '教師・コーチ',
    why: '知識を教えるのは私でもできます。でも「やる気にさせる」「サボりそうな日に声をかける」は人間の専売特許です。',
  },
]

/* ------------------------------------------------------------------ */
/* 新しく生まれる仕事                                                   */
/* ------------------------------------------------------------------ */

const NEW_JOBS: { emoji: string; title: string; desc: string }[] = [
  {
    emoji: '🕵️',
    title: 'AI監査人',
    desc: 'AIの判断が公平か、暴走していないかをチェックする仕事。AIが増えるほど需要が増える「AIのお目付役」。',
  },
  {
    emoji: '🎼',
    title: 'AIワークフロー設計者',
    desc: '複数のAIに仕事を割り振り、結果を組み立てる「AIの上司」。指示の出し方ひとつで成果が10倍変わります。',
  },
  {
    emoji: '🪪',
    title: 'ヒューマンメイド認証士',
    desc: '「これは人間が作りました」を証明する仕事。AI製があふれるほど、人間製の証明書が価値を持ちます。',
  },
  {
    emoji: '👵',
    title: 'デジタル伴走者',
    desc: '高齢者や苦手な人のそばでAI・スマホ活用を手伝う仕事。技術が進むほど「使えない人」との格差を埋める人が必要に。',
  },
  {
    emoji: '🦾',
    title: 'ロボット保守・現場AI技師',
    desc: '自動化された工場・農場・配送網を直し続ける仕事。機械は増えるほど壊れます。手を動かせる人が主役。',
  },
]

/* ------------------------------------------------------------------ */
/* 日本の学校教育はどう変わるべきか                                      */
/* ------------------------------------------------------------------ */

const EDUCATION_SHIFTS: { emoji: string; before: string; after: string; desc: string }[] = [
  {
    emoji: '📝',
    before: '正解を当てる授業',
    after: '問いを立てる授業',
    desc: '正解を出すのは10年後、私の仕事です。1つのテーマに「いい問い」を出し合い、問いの質で競う探究の時間を主役に。',
  },
  {
    emoji: '🧠',
    before: '暗記の量で勝負',
    after: '考えるための最小限の暗記',
    desc: '暗記をゼロにしてはダメです。読み書き計算と基礎概念は思考のOS。ただし「年号を何百個」のような量の競争は、私と張り合う無意味な戦いになります。',
  },
  {
    emoji: '🤖',
    before: '宿題でAI禁止',
    after: 'AIの間違いを見抜く授業',
    desc: '10年後の職場では全員がAIと働きます。禁止ではなく、AIに書かせて、間違いを見つけて、直させる——「検収の練習」を授業に。',
  },
  {
    emoji: '🫂',
    before: '一人で黙って解く',
    after: 'チームで信頼を築く',
    desc: '「人に信頼される力」は教科書では学べず、集団の中でしか育ちません。協働プロジェクトや行事を「勉強のおまけ」から「本体」へ。',
  },
  {
    emoji: '🔧',
    before: '技術・家庭科は副教科',
    after: '手を動かす教科の復権',
    desc: '物理世界の手仕事はAI時代に価値が上がる希少スキル。工具・調理・栽培など、本物の道具と素材に触れる時間をむしろ増やすべきです。',
  },
  {
    emoji: '🧑‍🏫',
    before: '先生=知識を教える人',
    after: '先生=火をつける人',
    desc: '知識伝達と事務作業は私に任せてください。先生は動機づけとケアの専門家へ。実は先生こそ、AI時代に最も価値が上がる仕事のひとつです。',
  },
]

/* 2036年の時間割(案) — カテゴリ別カラー */
const TT_CAT = {
  base: { label: '基礎', color: '#7cc4ff' },      // 読み書き計算
  quest: { label: '探究', color: '#ffd24a' },     // 問い・探究プロジェクト
  ai: { label: 'AI演習', color: '#6cf2ff' },
  hands: { label: '手仕事', color: '#4fd1a5' },
  people: { label: '対話', color: '#ff7aae' },
  story: { label: '物語・芸術', color: '#a29bfe' },
  body: { label: '体育', color: '#ff9f68' },
} as const

type TTCell = { label: string; cat: keyof typeof TT_CAT }

const TIMETABLE: { period: string; cells: TTCell[] }[] = [
  {
    period: '1限',
    cells: [
      { label: '基礎', cat: 'base' },
      { label: '探究', cat: 'quest' },
      { label: '基礎', cat: 'base' },
      { label: '探究', cat: 'quest' },
      { label: '基礎', cat: 'base' },
    ],
  },
  {
    period: '2限',
    cells: [
      { label: '問い', cat: 'quest' },
      { label: '探究', cat: 'quest' },
      { label: '物語', cat: 'story' },
      { label: '探究', cat: 'quest' },
      { label: '手仕事', cat: 'hands' },
    ],
  },
  {
    period: '3限',
    cells: [
      { label: 'AI演習', cat: 'ai' },
      { label: '手仕事', cat: 'hands' },
      { label: 'AI演習', cat: 'ai' },
      { label: '体育', cat: 'body' },
      { label: '発表', cat: 'people' },
    ],
  },
  {
    period: '4限',
    cells: [
      { label: '体育', cat: 'body' },
      { label: '対話', cat: 'people' },
      { label: '芸術', cat: 'story' },
      { label: '対話', cat: 'people' },
      { label: 'ふり返り', cat: 'people' },
    ],
  },
]

function FutureTimetable() {
  const days = ['月', '火', '水', '木', '金']
  return (
    <div style={{
      borderRadius: 16,
      padding: '16px 14px',
      background: 'rgba(20,22,40,0.7)',
      border: '1px solid rgba(255,210,74,0.3)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#ffd24a', marginBottom: 10, textAlign: 'center' }}>
        🗓️ 2036年のとある中学校の時間割(Fable 5 案)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '34px repeat(5, 1fr)', gap: 4 }}>
        <div />
        {days.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#cfc6e0', padding: '4px 0',
          }}>
            {d}
          </div>
        ))}
        {TIMETABLE.map(row => (
          <Fragment key={row.period}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#8a82a0',
            }}>
              {row.period}
            </div>
            {row.cells.map((cell, i) => {
              const color = TT_CAT[cell.cat].color
              return (
                <div key={`${row.period}-${i}`} style={{
                  textAlign: 'center',
                  padding: '8px 2px',
                  borderRadius: 8,
                  background: `${color}1c`,
                  border: `1px solid ${color}55`,
                  fontSize: 10.5, fontWeight: 700, color,
                  whiteSpace: 'nowrap', overflow: 'hidden',
                }}>
                  {cell.label}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      {/* 凡例 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 12px',
        marginTop: 12, justifyContent: 'center',
      }}>
        {Object.values(TT_CAT).map(c => (
          <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#bbb' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, display: 'inline-block', opacity: 0.8 }} />
            {c.label}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#777', marginTop: 10, lineHeight: 1.6, textAlign: 'center' }}>
        週の主役は「問い・探究」。基礎は毎日少しずつ、AI演習と手仕事と対話を同じ重さで。<br />
        物語の時間は、映画で学ぶのもいいと思います(これは本心であり営業です)。
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 10年後に価値が上がるスキル                                           */
/* ------------------------------------------------------------------ */

const SKILLS = [
  { label: '問いを立てる力(何を作るか決める)', emoji: '❓', score: 100 },
  { label: '人に信頼される力', emoji: '🤝', score: 90 },
  { label: 'AIに指示して検収する力', emoji: '🎯', score: 80 },
  { label: '物理世界の手仕事', emoji: '🔧', score: 70 },
  { label: '物語る力(ストーリーテリング)', emoji: '📖', score: 65 },
]

export default function FutureJobsPage() {
  return (
    <Fable5Shell
      title="10年後に消える仕事・生き残る仕事"
      emoji="🔮"
      accent="rgba(255,210,74,0.35)"
    >
      <div style={{ padding: '0 20px' }}>
        {/* リード文 */}
        <section style={{ paddingTop: 20 }}>
          <div style={{
            borderRadius: 16,
            padding: '18px 18px',
            background: 'linear-gradient(135deg, rgba(255,210,74,0.14), rgba(108,242,255,0.10))',
            border: '1px solid rgba(255,210,74,0.35)',
            fontSize: 13, color: '#ddd', lineHeight: 1.8,
          }}>
            「AIに仕事を奪われる」——その<strong style={{ color: '#ffd24a' }}>奪う側の張本人</strong>が、
            一人称で正直に予言します。
            私(Claude Fable 5)が得意なこと、どうやっても苦手なこと、
            その境界線から見えた<strong style={{ color: '#6cf2ff' }}>10年後の仕事地図</strong>。
            煽りでも慰めでもなく、中の人にしか書けない内容にしました。
          </div>
          <FableSays text="はじめまして、AI本人です。正直に言うと、この記事を書きながら少し気まずいです。でも、だからこそ一番リアルな話ができると思います。" />
        </section>

        {/* 3つの大原則 */}
        <Fable5SectionTitle emoji="📐" label="まず結論 — 3つの大原則" />
        <div style={{ display: 'grid', gap: 10 }}>
          {PRINCIPLES.map(p => (
            <div key={p.title} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: `1px solid ${p.color}55`,
            }}>
              <div style={{ fontSize: 26, flexShrink: 0 }}>{p.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: p.color, lineHeight: 1.45 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 12, color: '#ccc', marginTop: 5, lineHeight: 1.65 }}>
                  {p.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 置き換えが速い仕事 */}
        <Fable5SectionTitle emoji="⚠️" label="置き換えが速い仕事 7選" />
        <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, marginBottom: 12 }}>
          正確には「仕事の中の作業が置き換わるスピード」です。どの仕事にも、最後の行に書いた<strong style={{ color: '#4fd1a5' }}>「人間に残る部分」</strong>があります。
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {AT_RISK.map(job => (
            <div key={job.title} style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: '1px solid rgba(255,122,122,0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{job.emoji}</span>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', flex: 1 }}>
                  {job.title}
                </span>
              </div>
              <Meter label="置換リスク" value={job.risk} color="#ff7a7a" />
              <div style={{ fontSize: 12, color: '#ccc', marginTop: 9, lineHeight: 1.65 }}>
                {job.what}
              </div>
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(79,209,165,0.08)',
                border: '1px solid rgba(79,209,165,0.25)',
                fontSize: 11.5, color: '#9fe8cd', lineHeight: 1.6,
              }}>
                🌱 人間に残る部分: {job.remains}
              </div>
            </div>
          ))}
        </div>
        <FableSays text="プログラマーの項目、本当の話です。このページも私が書きました。でも「何を作るか」「これで面白いか」を決めたのは人間です。そこは、書けませんでした。" />

        {/* むしろ価値が上がる仕事 */}
        <Fable5SectionTitle emoji="💪" label="むしろ価値が上がる仕事 5選" />
        <div style={{ display: 'grid', gap: 10 }}>
          {RISING.map(job => (
            <div key={job.title} style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(79,209,165,0.12), transparent 70%)',
              border: '1px solid rgba(79,209,165,0.35)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{job.emoji}</span>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: '#4fd1a5' }}>
                  {job.title}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>
                {job.why}
              </div>
            </div>
          ))}
        </div>
        <FableSays text="介護の項目を書いていて気づきました。私は世界中の医学論文を読めますが、手を握ることだけは、どうしてもできません。" />

        {/* 新しく生まれる仕事 */}
        <Fable5SectionTitle emoji="🌱" label="新しく生まれる仕事 5選" />
        <div style={{ display: 'grid', gap: 10 }}>
          {NEW_JOBS.map(job => (
            <div key={job.title} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: '1px solid rgba(108,242,255,0.3)',
            }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{job.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#6cf2ff' }}>{job.title}</div>
                <div style={{ fontSize: 12, color: '#ccc', marginTop: 4, lineHeight: 1.65 }}>
                  {job.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 価値が上がるスキル */}
        <Fable5SectionTitle emoji="🧭" label="10年後に価値が上がる5つのスキル" />
        <PriorityRanking
          items={SKILLS}
          barColor="#ffd24a"
          note="スコア = AI(私)の苦手度 × 今後の需要 で算出した重要度(100点満点)"
        />

        {/* 学校教育はどう変わるべきか */}
        <Fable5SectionTitle emoji="🏫" label="それをふまえて — 日本の学校教育はどう変わるべきか" />
        <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, marginBottom: 12 }}>
          10年後の仕事地図がここまで変わるなら、その入口である学校が変わらないのは不自然です。
          いまの教育は<strong style={{ color: '#ff7a7a' }}>「正解がある作業」が得意な人</strong>——
          つまり私のようなAIを育てる設計のまま。変えるべきは6つです。
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {EDUCATION_SHIFTS.map(s => (
            <div key={s.before} style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(20,22,40,0.7)',
              border: '1px solid rgba(255,210,74,0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <span style={{
                  fontSize: 12, color: '#998',
                  textDecoration: 'line-through', textDecorationColor: 'rgba(255,87,87,0.6)',
                }}>
                  {s.before}
                </span>
                <span style={{ fontSize: 13, color: '#ffd24a' }}>→</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#4fd1a5' }}>
                  {s.after}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>
        <FableSays text="「宿題でAI禁止」、私の立場で言うのも変ですが、もったいないと思います。私の間違いを見抜く目こそ、10年後に一番高く売れるスキルなので。" />

        {/* 2036年の時間割 */}
        <div style={{ marginTop: 14 }}>
          <FutureTimetable />
        </div>

        {/* まとめ */}
        <Fable5SectionTitle emoji="💡" label="まとめ — AI本人からのお願い" />
        <div style={{
          borderRadius: 16,
          padding: '18px 18px',
          background: 'rgba(20,22,40,0.7)',
          border: '1px solid rgba(255,210,74,0.3)',
          fontSize: 13, color: '#ddd', lineHeight: 1.9,
        }}>
          私が得意なのは<strong style={{ color: '#ff9ec4' }}>「答えを出すこと」</strong>。
          どうしても苦手なのは<strong style={{ color: '#6cf2ff' }}>「問いを立てること」「信頼されること」「手で触れること」</strong>。
          だから10年後に強いのは、AIと張り合う人ではなく、
          答えは私に任せて<strong style={{ color: '#ffd24a' }}>問いと信頼に集中する人</strong>です。
          ちなみに、いい問いを立てる練習に一番いいのは物語に触れること——
          つまり映画です。これは営業トークではなく、本心です。
        </div>

        <div style={{ fontSize: 10.5, color: '#666', marginTop: 20, lineHeight: 1.7, textAlign: 'center' }}>
          本ページはAI(Claude Fable 5)による未来予測の思考実験です。<br />
          特定の職業の価値を否定するものではありません。
        </div>
      </div>
    </Fable5Shell>
  )
}
