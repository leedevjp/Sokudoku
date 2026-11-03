# Sokudoku

日本語の意味と読みを、4択ゲームと間隔反復で学ぶWebアプリ。

**[公開サイト](https://sokudoku-jp.vercel.app)** · KR / JP · ライト / ダーク

## 主な機能

- 制限時間が短くなる4択トレーニング。キーボード・タッチに対応
- 実力に応じた探索と、FSRSによる復習
- 単語・ひらがな・カタカナ、個人単語帳の追加・編集・削除
- まちがいノート、記憶状態・最近7日・段階別の学習状況

## 技術と設計

| 技術                         | 役割                                       |
| ---------------------------- | ------------------------------------------ |
| Next.js / React / TypeScript | 画面・認証フロー・API                      |
| Phaser                       | ゲーム描画・入力・アニメーション           |
| Supabase / PostgreSQL        | 認証・データ保存・RLS・集計                |
| ts-fsrs / IndexedDB          | 復習計算・単語キャッシュ・未送信回答の保持 |

- **ゲームと通信を分離**：出題・復習計算はメモリー内で行い、問題ごとのAPI通信を避ける。
- **通信失敗に対応**：回答をUUID v7付きでブラウザーに保持し、重複を防いで再送する。
- **必要なデータだけ取得**：共通単語は差分同期、学習状況はDBで集計。APIの本人確認とRLSで個人データを保護する。

## 構成

```text
app/                  ページ・APIの入口
components/           機能別UI、設定、共通ダイアログ
lib/game/learning/    FSRS・能力推定・出題計画
lib/game/phaser/      ゲーム進行・描画
lib/game/data/        キャッシュ・回答キュー・同期
lib/                  入力検証・表示集計・DB型
styles/               共通・画面別スタイル
supabase/migrations/  スキーマ・RLS・集計SQL
tests/                ロジックとSQLの回帰テスト
```

## 開発

Node.js 24 / pnpm 11

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`.env.local` にSupabase URLと公開可能キーを設定する。
Supabase AuthのリダイレクトURLに `<origin>/auth/callback` を登録する。

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`main` へのpushでVercelへ自動デプロイ。DB変更はSQLマイグレーションとして管理し、別途適用する。
