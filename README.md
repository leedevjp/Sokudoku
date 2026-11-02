# Sokudoku

日本語の単語を見て、意味と読みをすばやく思い出すためのトレーニングゲームです。

公開サイト: https://sokudoku-jp.vercel.app

## 実装状況

- メールアドレスとパスワードによる新規登録・ログイン
- 確認メールの認証コールバック
- ログアウト、セッションの復元・更新
- サーバーで認証を検証するユーザー情報API
- 日本語の画面・通知・エラーメッセージ

認証にはSupabase Authを使用し、アプリ専用テーブルはまだ作成していません。ゲーム本体、単語管理、学習記録の同期は今後実装します。設計書はローカルで別途管理します。

## 開発環境

Node.js 24とpnpm 11.15.1を使用します。

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# .env.localにSokudoku専用のSupabase URLと公開可能キーを設定
pnpm dev
```

```sh
pnpm build
pnpm start
```

`.env.local`と`.vercel/`はGit管理対象外です。秘密キーやservice_roleキーをリポジトリや`NEXT_PUBLIC_`変数に含めないでください。Todoとは別のSupabaseプロジェクトを使用します。

## 認証設定

SupabaseのAuthentication → URL Configurationで次の値を設定します。

- Site URL: `https://sokudoku-jp.vercel.app`
- Redirect URLs: `https://sokudoku-jp.vercel.app/auth/callback`
- ローカル開発用: `http://localhost:3000/auth/callback`（ポートを変更する場合はそのURLも登録）

メールプロバイダーとメール認証を有効にしてください。PKCEコードをセッションに交換するため、確認メールは登録時と同じブラウザーで開きます。無効なリンクは`/auth/error`に案内します。

`/api/auth/user`はサーバーの`getUser()`で検証したユーザーのIDとメールアドレスだけを返します。未認証時は401を返し、認証関連の応答は`private, no-store`に設定します。

## Vercelのビルドとデプロイ

プロジェクト: `leedevjps-projects/sokudoku`

| 設定 | 値 |
| --- | --- |
| フレームワーク | Next.js |
| Node.js | 24.x |
| インストールコマンド | `pnpm install --frozen-lockfile` |
| ビルドコマンド | `pnpm build` |
| 出力先 | Next.jsの既定値（上書きしない） |
| 本番ブランチ | `main` |

GitHubの`leedevjp/Sokudoku`と連携しています。`main`へのpushは本番デプロイを開始します。別ブランチのプルリクエストではプレビューデプロイが作成されます。pushによってプルリクエストそのものが自動作成されるわけではありません。

Vercelはビルド後のデプロイを管理するため、別途`pnpm start`をデプロイコマンドとして設定する必要はありません。

手動で本番にデプロイする場合:

```sh
vercel deploy --prod --scope leedevjps-projects
```

Vercelの環境変数に`NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`を設定します。`NEXT_PUBLIC_`の値はブラウザーに公開されるため、秘密キーは使用しないでください。
