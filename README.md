This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## ミニゲーム (絵文字タイトル当て) のセットアップ

1. Supabase でマイグレーション `supabase/migrations/00015_emoji_quiz.sql` を適用
2. https://aistudio.google.com/apikey で API キーを発行（無料、クレカ不要）
3. `.env.local` に追加:
   ```
   GEMINI_API_KEY=AIza...
   ```
4. 出題プールをシード（無料枠内、500件で約8分）:
   ```bash
   npm install
   npm run seed:emoji-quizzes
   ```
5. `npm run dev` を起動して Profile タブ →「🎮 絵文字タイトル当て」から動作確認

オプション:
- `npm run seed:emoji-quizzes -- --limit=100` で件数を絞る
- `npm run seed:emoji-quizzes -- --type=tv` でドラマのみ
- `npm run seed:emoji-quizzes -- --dry-run` で生成せず TMDB 取得だけ確認

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
