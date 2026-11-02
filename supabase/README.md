# SokudokuのSupabase設定

- プロジェクト名: Sokudoku
- プロジェクト参照ID: wjwtfuocfbvkwhspacpg
- 組織: leedevjp
- リージョン: ap-northeast-1（東京）
- 管理画面: https://supabase.com/dashboard/project/wjwtfuocfbvkwhspacpg

ローカル接続設定はGit管理対象外の`.env.local`に保存します。デプロイ先の環境変数はVercelで別途設定します。現在の認証実装にservice_roleキーは不要です。`word`テーブルのマイグレーションを適用済みです。

## word

| カラム | 内容 |
| --- | --- |
| id | 自動生成UUIDの主キー |
| term | 日本語の表記 |
| kana | 仮名の読み |
| hanja_reading | 韓国漢字音、該当しなければNULL |
| meaning_ko | 韓国語の意味 |
| has_kanji | 漢字を含むか（登録時に明示） |
| difficulty | 0〜10、既定値3 |
| note | 任意の説明 |
| created_at | 登録日時 |
| updated_at | DBトリガーで更新される変更日時 |
| deleted_at | 論理削除日時、通常NULL |

`term + kana`は論理削除済みを含めて一意です。再登録時は既存行を復元します。難易度は0〜1がN5、2〜3がN4、4〜5がN3、6〜7がN2、8〜9がN1、10が試験範囲外の生活・専門・固有名詞などを表す独自の目安です。

RLSを有効にし、ログイン済みユーザーにはSELECTだけを許可します。キャッシュ同期に削除マーカーが必要なため、論理削除済みの行も参照可能です。出題時はdeleted_atがNULLの行に絞ります。未認証アクセスと一般ユーザーによる追加・更新・削除は禁止します。編集は信頼された管理用接続またはSupabase MCPで行います。
