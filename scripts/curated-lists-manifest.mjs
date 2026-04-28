// キュレーションリスト定義 (Filmo編集部)
//
// SEO狙いのキーワード + 国・地域・年代バリエーション + 用途別ターゲット。
// 各リストは selection オブジェクトで TMDB の /discover パラメータか、
// 静的 movieIds 配列を指定する。
//
// 追加・修正は自由。npm run seed:curated で再実行 (idempotent: タイトル/slug 一致なら更新)。

export const CURATED_LISTS = [
  // ========================================
  // 1. 年代別オールタイム名作 (SEO直球)
  // ========================================
  {
    slug: 'best-movies-2020s',
    title: '2020年代のベスト映画',
    description: '2020年以降に公開された必見の名作映画。コロナ禍を経て映画体験はどう変わったか。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '2020-01-01', 'primary_release_date.lte': '2029-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 30,
  },
  {
    slug: 'best-movies-2010s',
    title: '2010年代のベスト映画',
    description: '2010〜2019年公開作品から選ぶ、必ず観ておきたい名作30本。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '2010-01-01', 'primary_release_date.lte': '2019-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '1000' } },
    limit: 30,
  },
  {
    slug: 'best-movies-2000s',
    title: '2000年代のベスト映画',
    description: '2000〜2009年公開、ミレニアム以降の映画文化を象徴する名作たち。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2009-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '1500' } },
    limit: 30,
  },
  {
    slug: 'best-movies-90s',
    title: '90年代の名作映画',
    description: 'タランティーノ・スピルバーグ全盛期、世界中で愛された90年代の傑作。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '1500' } },
    limit: 30,
  },
  {
    slug: 'best-movies-80s',
    title: '80年代の名作映画',
    description: 'インディジョーンズ、バックトゥザフューチャー、E.T.…誰もが知ってるあの時代。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '1980-01-01', 'primary_release_date.lte': '1989-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '1000' } },
    limit: 30,
  },
  {
    slug: 'best-movies-70s',
    title: '70年代の名作映画',
    description: 'ニューシネマからスターウォーズまで、映画史の転換点となった70年代。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '1970-01-01', 'primary_release_date.lte': '1979-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 25,
  },
  {
    slug: 'best-movies-60s',
    title: '60年代の名作映画',
    description: 'ヒッチコック、キューブリック、黒澤明…映画黄金時代の傑作集。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '1960-01-01', 'primary_release_date.lte': '1969-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '300' } },
    limit: 20,
  },

  // ========================================
  // 2. 邦画 (国別 SEO)
  // ========================================
  {
    slug: 'best-japanese-movies',
    title: '邦画オールタイムベスト',
    description: '黒澤明から是枝裕和まで、日本映画の歴史を彩る30本。',
    selection: { type: 'discover', params: { with_origin_country: 'JP', sort_by: 'vote_average.desc', 'vote_count.gte': '300' } },
    limit: 30,
  },
  {
    slug: 'best-japanese-movies-2020s',
    title: '2020年代の邦画ベスト',
    description: '近年公開の話題作・受賞作を中心に、いま観るべき日本映画。',
    selection: { type: 'discover', params: { with_origin_country: 'JP', 'primary_release_date.gte': '2020-01-01', sort_by: 'popularity.desc', 'vote_count.gte': '50' } },
    limit: 25,
  },
  {
    slug: 'best-japanese-movies-2010s',
    title: '2010年代の邦画ベスト',
    description: '是枝、新海、庵野…新世代の作家たちが描いた10年。',
    selection: { type: 'discover', params: { with_origin_country: 'JP', 'primary_release_date.gte': '2010-01-01', 'primary_release_date.lte': '2019-12-31', sort_by: 'vote_count.desc', 'vote_count.gte': '100' } },
    limit: 25,
  },
  {
    slug: 'best-japanese-movies-showa',
    title: '昭和の名作邦画',
    description: '黒澤、小津、溝口…昭和に生まれた映画の宝物たち。',
    selection: { type: 'discover', params: { with_origin_country: 'JP', 'primary_release_date.gte': '1950-01-01', 'primary_release_date.lte': '1989-12-31', sort_by: 'vote_average.desc', 'vote_count.gte': '50' } },
    limit: 20,
  },

  // ========================================
  // 3. 韓国映画 (高需要 SEO)
  // ========================================
  {
    slug: 'best-korean-movies',
    title: '韓国映画オールタイムベスト',
    description: 'パラサイト、オールド・ボーイ、バーニング…世界が認めるK-Cinemaの傑作。',
    selection: { type: 'discover', params: { with_origin_country: 'KR', sort_by: 'vote_count.desc', 'vote_count.gte': '300' } },
    limit: 30,
  },
  {
    slug: 'best-korean-movies-2020s',
    title: '2020年代の韓国映画',
    description: 'パラサイト以降、進化を続ける韓国映画の最前線。',
    selection: { type: 'discover', params: { with_origin_country: 'KR', 'primary_release_date.gte': '2020-01-01', sort_by: 'popularity.desc', 'vote_count.gte': '50' } },
    limit: 20,
  },
  {
    slug: 'korean-thrillers',
    title: '韓国スリラー・サスペンスの傑作',
    description: '韓国映画の真骨頂、極限まで張り詰めたスリラー&サスペンス。',
    selection: { type: 'discover', params: { with_origin_country: 'KR', with_genres: '53,80', sort_by: 'vote_count.desc', 'vote_count.gte': '200' } },
    limit: 20,
  },

  // ========================================
  // 4. 中華圏 (台湾・香港・中国)
  // ========================================
  {
    slug: 'best-taiwanese-movies',
    title: '台湾映画ベスト',
    description: 'エドワード・ヤンから侯孝賢、近年の話題作まで台湾映画の精選。',
    selection: { type: 'discover', params: { with_origin_country: 'TW', sort_by: 'vote_count.desc', 'vote_count.gte': '100' } },
    limit: 20,
  },
  {
    slug: 'best-hong-kong-movies',
    title: '香港映画ベスト',
    description: 'ウォン・カーウァイから王家衛、ジャッキー・チェンまで香港映画の名作。',
    selection: { type: 'discover', params: { with_origin_country: 'HK', sort_by: 'vote_count.desc', 'vote_count.gte': '200' } },
    limit: 20,
  },
  {
    slug: 'best-chinese-movies',
    title: '中国映画ベスト',
    description: 'チャン・イーモウ、チェン・カイコー…中華映画の大作たち。',
    selection: { type: 'discover', params: { with_origin_country: 'CN', sort_by: 'vote_count.desc', 'vote_count.gte': '200' } },
    limit: 20,
  },

  // ========================================
  // 5. 欧州映画 (国別)
  // ========================================
  {
    slug: 'best-french-movies',
    title: 'フランス映画ベスト',
    description: 'ヌーヴェル・ヴァーグから現代まで、フランス映画の珠玉のコレクション。',
    selection: { type: 'discover', params: { with_origin_country: 'FR', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 25,
  },
  {
    slug: 'best-italian-movies',
    title: 'イタリア映画ベスト',
    description: 'フェリーニ、デ・シーカ、ベルトルッチ…ヨーロッパ映画の源流。',
    selection: { type: 'discover', params: { with_origin_country: 'IT', sort_by: 'vote_count.desc', 'vote_count.gte': '300' } },
    limit: 20,
  },
  {
    slug: 'best-german-movies',
    title: 'ドイツ映画ベスト',
    description: 'ヴィム・ヴェンダース、ヘルツォーク…独自の哲学を持つドイツ映画。',
    selection: { type: 'discover', params: { with_origin_country: 'DE', sort_by: 'vote_count.desc', 'vote_count.gte': '300' } },
    limit: 20,
  },
  {
    slug: 'best-spanish-movies',
    title: 'スペイン映画ベスト',
    description: 'アルモドバル、デル・トロ…色彩と情熱のスペイン映画。',
    selection: { type: 'discover', params: { with_origin_country: 'ES', sort_by: 'vote_count.desc', 'vote_count.gte': '300' } },
    limit: 20,
  },
  {
    slug: 'best-uk-movies',
    title: 'イギリス映画ベスト',
    description: 'ロンドン下町コメディから格調高いコスチュームドラマまで、英国映画の決定版。',
    selection: { type: 'discover', params: { with_origin_country: 'GB', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 25,
  },

  // ========================================
  // 6. アジア・南米
  // ========================================
  {
    slug: 'best-indian-movies',
    title: 'インド映画ベスト',
    description: 'ボリウッドの巨匠から芸術派の名匠まで、インド映画の魅惑的な世界。',
    selection: { type: 'discover', params: { with_origin_country: 'IN', sort_by: 'vote_count.desc', 'vote_count.gte': '300' } },
    limit: 25,
  },
  {
    slug: 'best-thai-movies',
    title: 'タイ映画ベスト',
    description: 'アピチャッポンからホラー、コメディまで、タイ映画の多彩な魅力。',
    selection: { type: 'discover', params: { with_origin_country: 'TH', sort_by: 'vote_count.desc', 'vote_count.gte': '100' } },
    limit: 15,
  },
  {
    slug: 'best-iranian-movies',
    title: 'イラン映画ベスト',
    description: 'キアロスタミ、ファルハディ…世界の映画祭を席巻するイラン映画。',
    selection: { type: 'discover', params: { with_origin_country: 'IR', sort_by: 'vote_count.desc', 'vote_count.gte': '100' } },
    limit: 15,
  },
  {
    slug: 'best-mexican-movies',
    title: 'メキシコ映画ベスト',
    description: 'デル・トロ、イニャリトゥ、キュアロン…メキシコ映画の三巨匠と次世代。',
    selection: { type: 'discover', params: { with_origin_country: 'MX', sort_by: 'vote_count.desc', 'vote_count.gte': '200' } },
    limit: 20,
  },
  {
    slug: 'best-brazilian-movies',
    title: 'ブラジル映画ベスト',
    description: 'シティ・オブ・ゴッドから現代の社会派まで、ブラジル映画の力強い世界。',
    selection: { type: 'discover', params: { with_origin_country: 'BR', sort_by: 'vote_count.desc', 'vote_count.gte': '200' } },
    limit: 20,
  },

  // ========================================
  // 7. ジャンル別オールタイム (SEO高需要)
  // ========================================
  {
    slug: 'best-action-movies',
    title: 'アクション映画オールタイムベスト',
    description: '心拍数が上がりっぱなし、何度でも観たいアクション映画の決定版。',
    selection: { type: 'discover', params: { with_genres: '28', sort_by: 'vote_count.desc', 'vote_count.gte': '3000' } },
    limit: 30,
  },
  {
    slug: 'best-horror-movies',
    title: 'ホラー映画オールタイムベスト',
    description: '一人で見るのは怖すぎる、本物のホラー映画30本。',
    selection: { type: 'discover', params: { with_genres: '27', sort_by: 'vote_count.desc', 'vote_count.gte': '1500' } },
    limit: 30,
  },
  {
    slug: 'best-romance-movies',
    title: 'ロマンス映画オールタイムベスト',
    description: '何度観ても泣ける、恋愛映画の名作セレクション。',
    selection: { type: 'discover', params: { with_genres: '10749', sort_by: 'vote_count.desc', 'vote_count.gte': '2000' } },
    limit: 30,
  },
  {
    slug: 'best-scifi-movies',
    title: 'SF映画オールタイムベスト',
    description: 'ブレードランナーから2001、インターステラーまで、SF映画の傑作。',
    selection: { type: 'discover', params: { with_genres: '878', sort_by: 'vote_count.desc', 'vote_count.gte': '2000' } },
    limit: 30,
  },
  {
    slug: 'best-comedy-movies',
    title: 'コメディ映画オールタイムベスト',
    description: '腹から笑える、何度見ても面白いコメディ映画の名作。',
    selection: { type: 'discover', params: { with_genres: '35', sort_by: 'vote_count.desc', 'vote_count.gte': '2000' } },
    limit: 30,
  },
  {
    slug: 'best-thriller-movies',
    title: 'スリラー映画オールタイムベスト',
    description: '一瞬たりとも気が抜けない、心を掴んで離さないスリラー。',
    selection: { type: 'discover', params: { with_genres: '53', sort_by: 'vote_count.desc', 'vote_count.gte': '2000' } },
    limit: 30,
  },
  {
    slug: 'best-mystery-movies',
    title: 'ミステリー映画ベスト',
    description: '謎が謎を呼ぶ、見終わってからも考え続けるミステリー映画。',
    selection: { type: 'discover', params: { with_genres: '9648', sort_by: 'vote_count.desc', 'vote_count.gte': '1500' } },
    limit: 25,
  },
  {
    slug: 'best-drama-movies',
    title: 'ヒューマンドラマ映画ベスト',
    description: '人間の機微を描いた、心揺さぶられるヒューマンドラマ。',
    selection: { type: 'discover', params: { with_genres: '18', sort_by: 'vote_count.desc', 'vote_count.gte': '3000' } },
    limit: 30,
  },
  {
    slug: 'best-animation-movies',
    title: 'アニメ映画オールタイムベスト',
    description: '日本アニメから海外作品まで、アニメ映画史の傑作。',
    selection: { type: 'discover', params: { with_genres: '16', sort_by: 'vote_count.desc', 'vote_count.gte': '2000' } },
    limit: 30,
  },
  {
    slug: 'best-fantasy-movies',
    title: 'ファンタジー映画オールタイムベスト',
    description: 'LotR、ナルニア、ハリポタ…別世界へ連れてくれるファンタジー。',
    selection: { type: 'discover', params: { with_genres: '14', sort_by: 'vote_count.desc', 'vote_count.gte': '2000' } },
    limit: 25,
  },
  {
    slug: 'best-documentary-movies',
    title: 'ドキュメンタリー映画ベスト',
    description: '事実が物語より奇なり。観終わると世界の見方が変わるドキュメンタリー。',
    selection: { type: 'discover', params: { with_genres: '99', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 20,
  },
  {
    slug: 'best-war-movies',
    title: '戦争映画ベスト',
    description: 'プライベート・ライアンから1917まで、戦場の真実を描いた傑作。',
    selection: { type: 'discover', params: { with_genres: '10752', sort_by: 'vote_count.desc', 'vote_count.gte': '1000' } },
    limit: 20,
  },
  {
    slug: 'best-crime-movies',
    title: 'クライム映画ベスト',
    description: 'ゴッドファーザー、グッドフェローズ…裏社会を描いた名作犯罪映画。',
    selection: { type: 'discover', params: { with_genres: '80', sort_by: 'vote_count.desc', 'vote_count.gte': '2000' } },
    limit: 25,
  },

  // ========================================
  // 8. ターゲット・用途別 (高intent SEO)
  // ========================================
  {
    slug: 'movies-for-english-learners',
    title: '英語学習におすすめの映画',
    description: '英語を勉強し始めた人にぴったり、聞き取りやすくセリフが豊かな名作。',
    // 静的キュレーション + popularity 補完
    selection: { type: 'discover', params: { with_original_language: 'en', with_genres: '10751,18', sort_by: 'popularity.desc', 'vote_count.gte': '2000' } },
    limit: 25,
  },
  {
    slug: 'movies-to-cry',
    title: '泣ける映画ベスト',
    description: '一人の夜にじっくり浸りたい、思いきり泣ける感動映画。',
    selection: { type: 'discover', params: { with_genres: '18,10749', sort_by: 'vote_average.desc', 'vote_count.gte': '2000' } },
    limit: 25,
  },
  {
    slug: 'movies-after-breakup',
    title: '失恋した夜に観たい映画',
    description: '一緒に泣いて、笑って、また前を向ける。失恋の夜のための映画。',
    selection: { type: 'discover', params: { with_genres: '10749,18', sort_by: 'vote_average.desc', 'vote_count.gte': '1000' } },
    limit: 20,
  },
  {
    slug: 'movies-for-rainy-day',
    title: '雨の日に観たい映画',
    description: '家でゆっくり、コーヒー片手に。雨音と相性のいい静謐な映画たち。',
    selection: { type: 'discover', params: { with_genres: '18,9648', sort_by: 'vote_average.desc', 'vote_count.gte': '500' } },
    limit: 20,
  },
  {
    slug: 'christmas-movies',
    title: 'クリスマス映画ベスト',
    description: 'ホーム・アローン、ラブ・アクチュアリー…毎年12月に観たくなる名作。',
    selection: { type: 'static', movieIds: [771, 9087, 508, 2693, 6957, 11525, 8916, 16859, 8049, 9381, 3597, 1271, 1701, 33489, 17974, 11618] },
    limit: 16,
  },
  {
    slug: 'family-friendly-movies',
    title: '家族で観たい映画ベスト',
    description: '子供から大人まで、世代を超えて楽しめるファミリー映画の決定版。',
    selection: { type: 'discover', params: { with_genres: '10751', sort_by: 'vote_count.desc', 'vote_count.gte': '3000' } },
    limit: 25,
  },
  {
    slug: 'date-night-movies',
    title: 'デートで観たい映画',
    description: '盛り上がる話題作から、心に残るロマンス映画まで。デートの夜に。',
    selection: { type: 'discover', params: { with_genres: '10749,35', sort_by: 'popularity.desc', 'vote_count.gte': '1500' } },
    limit: 20,
  },
  {
    slug: 'all-night-movies',
    title: '徹夜で観たい映画',
    description: '一度観始めたら止まらない、夜更かし覚悟の傑作シリーズ。',
    selection: { type: 'discover', params: { with_genres: '53,9648', sort_by: 'vote_average.desc', 'vote_count.gte': '2000' } },
    limit: 20,
  },
  {
    slug: 'mind-bending-movies',
    title: '頭をフル回転させる映画',
    description: 'インセプション、メメント、テネット…観終わってから議論したくなる映画。',
    selection: { type: 'discover', params: { with_genres: '878,53,9648', sort_by: 'vote_average.desc', 'vote_count.gte': '3000' } },
    limit: 20,
  },
  {
    slug: 'short-feel-good-movies',
    title: '90分で観られる気軽な映画',
    description: '時間がない夜に、サクッと観られる90分以内の良作。',
    selection: { type: 'discover', params: { 'with_runtime.lte': '95', sort_by: 'vote_average.desc', 'vote_count.gte': '1000' } },
    limit: 20,
  },

  // ========================================
  // 9. 監督/作家別 (固定 movieIds・SEO)
  // ========================================
  {
    slug: 'studio-ghibli',
    title: 'スタジオジブリ作品集',
    description: '宮崎駿・高畑勲・スタジオジブリの長編アニメ作品コレクション。',
    selection: { type: 'static', movieIds: [129, 4935, 8392, 11621, 14290, 81444, 16859, 17074, 17075, 17076, 21336, 56808, 124905, 246900, 569094, 9806, 1185, 1265] },
    limit: 18,
  },
  {
    slug: 'pixar-movies',
    title: 'ピクサー全作品',
    description: 'トイ・ストーリーから最新作まで、ピクサー・アニメーション・スタジオの長編作品。',
    selection: { type: 'discover', params: { with_companies: '3', sort_by: 'release_date.desc' } },
    limit: 30,
  },
  {
    slug: 'christopher-nolan',
    title: 'クリストファー・ノーラン作品',
    description: 'メメント、ダークナイト、インセプション、テネット…ノーランの全作品。',
    selection: { type: 'static', movieIds: [4912, 155, 27205, 49026, 49047, 157336, 272, 320588, 374720, 530915, 872585] },
    limit: 11,
  },
  {
    slug: 'quentin-tarantino',
    title: 'タランティーノ作品',
    description: 'パルプ・フィクション、キル・ビル、ジャンゴ…タランティーノ全作品。',
    selection: { type: 'static', movieIds: [680, 105, 311, 24, 16869, 273248, 68718, 466272, 567604] },
    limit: 9,
  },
  {
    slug: 'akira-kurosawa',
    title: '黒澤明作品',
    description: '七人の侍、羅生門、用心棒…世界に影響を与え続ける黒澤映画。',
    selection: { type: 'static', movieIds: [346, 548, 11878, 15784, 11645, 16208, 31963, 19394, 1018, 949, 962, 1071, 11827, 26840, 14186, 14216] },
    limit: 16,
  },
  {
    slug: 'studio-shinkai',
    title: '新海誠 作品集',
    description: '君の名は。、天気の子、すずめの戸締まり…新海誠監督の長編作品。',
    selection: { type: 'static', movieIds: [372058, 568160, 730154, 28009, 12683, 16998] },
    limit: 6,
  },
  {
    slug: 'hayao-miyazaki',
    title: '宮崎駿 監督作品',
    description: '宮崎駿が監督した長編アニメーション映画コレクション。',
    selection: { type: 'static', movieIds: [129, 4935, 8392, 14290, 21336, 81444, 16859, 568332, 569094, 11621] },
    limit: 10,
  },
  {
    slug: 'wes-anderson',
    title: 'ウェス・アンダーソン作品',
    description: 'グランド・ブダペスト・ホテル、ムーンライズ・キングダム…色彩と対称性の魔術師。',
    selection: { type: 'static', movieIds: [120467, 83666, 9428, 4538, 9298, 1255, 11545, 8967, 581732, 1235495] },
    limit: 10,
  },

  // ========================================
  // 10. 賞・映画祭 (SEO人気)
  // ========================================
  {
    slug: 'oscar-winners',
    title: 'アカデミー賞 作品賞 受賞作',
    description: '歴代アカデミー賞作品賞を受賞した名作映画コレクション。',
    selection: { type: 'static', movieIds: [496243, 76341, 348, 109, 4922, 1422, 1646, 392, 11324, 14, 12405, 19913, 75612, 80, 95, 36657, 4350, 9806, 12, 274, 600, 1538, 197, 489, 16873, 11036, 539, 105, 16869, 109443] },
    limit: 30,
  },
  {
    slug: 'cannes-palme-dor',
    title: 'カンヌ国際映画祭 パルム・ドール受賞作',
    description: '世界で最も権威ある映画祭、カンヌの最高賞を獲った作品集。',
    selection: { type: 'static', movieIds: [496243, 466420, 530385, 273481, 14160, 290098, 21755, 24634, 1729, 80, 84319, 80921, 1422, 79132, 76341, 49018, 47964, 100404, 530915] },
    limit: 19,
  },
  {
    slug: 'venice-golden-lion',
    title: 'ヴェネツィア国際映画祭 金獅子賞',
    description: '芸術性と独創性を讃える金獅子賞、過去の受賞作品。',
    selection: { type: 'static', movieIds: [820067, 491418, 466420, 433, 67890, 76757, 4787, 51876, 152532, 245168, 545611, 614462] },
    limit: 12,
  },
  {
    slug: 'japan-academy-prize',
    title: '日本アカデミー賞 最優秀作品賞',
    description: '日本アカデミー賞 最優秀作品賞を受賞した邦画の名作。',
    selection: { type: 'static', movieIds: [76341, 372058, 38142, 30604, 19353, 569094, 18785, 79132, 13056, 56295] },
    limit: 10,
  },

  // ========================================
  // 11. 配信プラットフォーム別 (高需要 SEO)
  // ========================================
  {
    slug: 'netflix-best-originals',
    title: 'Netflix オリジナル名作映画',
    description: 'Netflix が制作したオリジナル映画の中から特に評価の高い作品。',
    selection: { type: 'discover', params: { with_companies: '178464', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 25,
  },
  {
    slug: 'a24-best-movies',
    title: 'A24 配給作品ベスト',
    description: 'ムーンライト、エブエブ、ヘレディタリー…A24の話題作・名作集。',
    selection: { type: 'discover', params: { with_companies: '41077', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 25,
  },

  // ========================================
  // 12. シリーズもの (検索数高い)
  // ========================================
  {
    slug: 'marvel-mcu',
    title: 'マーベル・シネマティック・ユニバース 全作品',
    description: 'アイアンマンから最新作まで、MCU 全作品を公開順で。',
    selection: { type: 'discover', params: { with_companies: '420', sort_by: 'release_date.asc' } },
    limit: 30,
  },
  {
    slug: 'james-bond',
    title: '007 ジェームズ・ボンド全作品',
    description: 'コネリーからクレイグまで、60年続く007シリーズの全25作。',
    selection: { type: 'static', movieIds: [646, 657, 658, 660, 681, 667, 668, 670, 681, 671, 691, 700, 254, 188, 707, 710, 714, 36670, 36668, 36669, 36671, 36672, 10764, 36670, 381061, 246403] },
    limit: 25,
  },
  {
    slug: 'star-wars',
    title: 'スター・ウォーズ サーガ',
    description: 'A New Hope から最新作まで、銀河の物語。',
    selection: { type: 'static', movieIds: [11, 1891, 1892, 1893, 1894, 1895, 140607, 181808, 181812, 348350, 330459, 535, 70981] },
    limit: 13,
  },
  {
    slug: 'lord-of-the-rings',
    title: 'ロード・オブ・ザ・リング 三部作 + ホビット',
    description: '中つ国を巡る壮大な旅。LotR三部作 + ホビット三部作。',
    selection: { type: 'static', movieIds: [120, 121, 122, 49051, 57158, 122917] },
    limit: 6,
  },
  {
    slug: 'harry-potter',
    title: 'ハリー・ポッター&ファンタスティック・ビースト',
    description: '魔法ワールド10作品をまとめてどうぞ。',
    selection: { type: 'static', movieIds: [671, 672, 673, 674, 675, 767, 12444, 12445, 259316, 338952, 338953, 614930] },
    limit: 12,
  },
  {
    slug: 'jurassic-park',
    title: 'ジュラシック・パーク/ワールド シリーズ',
    description: '恐竜映画の金字塔、ジュラシック・パーク全シリーズ。',
    selection: { type: 'static', movieIds: [329, 330, 331, 135397, 351286, 507086, 1022787] },
    limit: 7,
  },
  {
    slug: 'mission-impossible',
    title: 'ミッション:インポッシブル全作品',
    description: 'トム・クルーズの代名詞、M:I シリーズ全作。',
    selection: { type: 'static', movieIds: [954, 955, 956, 56292, 177677, 353081, 575265, 670292] },
    limit: 8,
  },

  // ========================================
  // 13. 文化的記憶 (年代別×ターゲット)
  // ========================================
  {
    slug: 'showa-cinema-with-parents',
    title: '昭和生まれが親と映画館で観た映画',
    description: '昭和の終わり、家族で映画館に行った思い出の作品たち。',
    selection: { type: 'static', movieIds: [129, 4935, 8392, 14290, 16859, 81444, 9091, 6479, 8587, 1924, 11342, 813, 105, 1891, 11, 601, 18, 524, 396, 78] },
    limit: 20,
  },
  {
    slug: 'heisei-90s-anime',
    title: '平成生まれが学校帰りに観たアニメ',
    description: '90s〜00sの放課後、テレビで観たあのアニメ映画たち。',
    selection: { type: 'static', movieIds: [129, 16859, 81444, 8392, 14290, 11621, 8587, 949, 16998, 38142, 372058, 568160, 17331, 18491, 20510, 38576] },
    limit: 16,
  },
  {
    slug: 'reiwa-z-favorites',
    title: 'Z世代に愛される映画',
    description: 'TikTokやInstagramで話題、若い世代が今観てる映画。',
    selection: { type: 'discover', params: { 'primary_release_date.gte': '2018-01-01', sort_by: 'popularity.desc', 'vote_count.gte': '500' } },
    limit: 25,
  },

  // ========================================
  // 14. 教育・自己啓発 (SEO高intent)
  // ========================================
  {
    slug: 'biographical-movies',
    title: '実話・伝記映画ベスト',
    description: '歴史を変えた人々、知られざる事件…事実に基づく名作。',
    selection: { type: 'discover', params: { with_keywords: '5565', sort_by: 'vote_count.desc', 'vote_count.gte': '1500' } },
    limit: 25,
  },
  {
    slug: 'business-movies',
    title: 'ビジネスマン必見の映画',
    description: 'ウォーストリート、ソーシャル・ネットワーク…ビジネスの世界を描いた名作。',
    selection: { type: 'static', movieIds: [37799, 38985, 1051896, 38357, 11324, 818, 22, 16858, 13183, 9089, 49018, 14160, 1422, 49047, 33908] },
    limit: 15,
  },
  {
    slug: 'sports-movies',
    title: 'スポーツ映画ベスト',
    description: 'ロッキー、レイジング・ブル、フィールド・オブ・ドリームス…熱いスポーツ映画。',
    selection: { type: 'discover', params: { with_genres: '18', with_keywords: '6075|236|9748|10336', sort_by: 'vote_count.desc', 'vote_count.gte': '500' } },
    limit: 20,
  },
  {
    slug: 'music-movies',
    title: '音楽映画ベスト',
    description: 'ボヘミアン・ラプソディ、ラ・ラ・ランド…音楽が主役の名作。',
    selection: { type: 'discover', params: { with_genres: '10402', sort_by: 'vote_count.desc', 'vote_count.gte': '1000' } },
    limit: 20,
  },

  // ========================================
  // 15. 季節・イベント (SEO季節検索)
  // ========================================
  {
    slug: 'summer-vacation-movies',
    title: '夏休みに観たい映画',
    description: '夏の思い出、青春、海、花火…夏が舞台のキラキラする映画。',
    selection: { type: 'static', movieIds: [129, 14290, 11036, 17331, 38142, 372058, 568160, 9091, 8587, 730154, 565310, 1018, 4329] },
    limit: 13,
  },
  {
    slug: 'halloween-movies',
    title: 'ハロウィンに観るホラー映画',
    description: '10月最後の夜、定番のスラッシャーから現代ホラーまで。',
    selection: { type: 'discover', params: { with_genres: '27', sort_by: 'popularity.desc', 'vote_count.gte': '1000' } },
    limit: 20,
  },
  {
    slug: 'new-year-movies',
    title: 'お正月に観る映画ベスト',
    description: '家族で集まるお正月、みんなで楽しめる映画たち。',
    selection: { type: 'discover', params: { with_genres: '10751,12', sort_by: 'vote_count.desc', 'vote_count.gte': '3000' } },
    limit: 15,
  },
]
