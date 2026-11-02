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

## answer_log

1問につき1件の回答結果を保存します。

| カラム | 内容 |
| --- | --- |
| id | ブラウザーで生成するUUID、再送時も同じ値 |
| user_id | auth.usersへの外部キー、既定値auth.uid() |
| word_id | 出題したwordのID |
| question_type | meaning / reading |
| selected_word_id | 選んだwordのID、時間切れはNULL |
| result | correct / incorrect / timeout |
| response_ms | 有効応答時間（ミリ秒） |
| time_limit_ms | 出題時の制限時間（ミリ秒）、正の整数 |
| answered_at | ブラウザーで結果を確定した日時 |
| received_at | DBの初回受信日時、一般ユーザーは指定不可 |

正答は選択IDが出題IDと一致、不正解は不一致とします。どちらもresponse_msは0以上かつtime_limit_ms未満です。時間切れでは選択IDをNULLとし、response_msとtime_limit_msを一致させます。制限時間ちょうどの回答は時間切れです。

RLSにより自分のログだけをSELECT・INSERTできます。一般ユーザーによるUPDATE・DELETEは禁止します。ユーザー削除時はログも削除し、参照されている単語の物理削除は禁止します。単語は論理削除してください。

再送は同じUUIDでINSERT ... ON CONFLICT (id) DO NOTHINGを使い、記録を上書きしません。今後の保存APIでは認証セッションからuser_idを設定します。

最近の回答はuser_id・word_id・question_typeごとにanswered_at DESC, id DESCで決定的に並べます。その複合インデックスと、単語の外部キー用インデックスを作成済みです。統計VIEWや保存APIはこのマイグレーションの対象外です。
