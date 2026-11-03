import type { Lang } from "../game/preferences";
export function personalMessage(code: string, lang: Lang) {
  const messages: Record<string, [string, string]> = {
    unauthorized: ["ログインし直してください。", "다시 로그인해주세요."],
    duplicate: [
      "同じ表記と読みの単語がすでにあります。",
      "같은 표기와 읽기의 단어가 이미 있어요.",
    ],
    stale: [
      "ほかの画面で変更されています。入力を控え、一覧を更新してから開き直してください。",
      "다른 화면에서 먼저 변경됐어요. 입력 내용을 보관하고 목록을 새로고침한 뒤 다시 열어주세요.",
    ],
    not_found: [
      "削除済みか、アクセスできない単語です。一覧を更新してください。",
      "삭제됐거나 접근할 수 없는 단어예요. 목록을 새로고침해주세요.",
    ],
    invalid_input: [
      "入力内容を確認してください。",
      "입력 내용을 확인해주세요.",
    ],
    load_failed: [
      "読み込めませんでした。もう一度お試しください。",
      "불러오지 못했어요. 다시 시도해주세요.",
    ],
    save_failed: [
      "保存できませんでした。入力はそのままで再試行できます。",
      "저장하지 못했어요. 입력은 유지되니 다시 시도해주세요.",
    ],
  };
  return (messages[code] ?? messages.save_failed)[lang === "jp" ? 0 : 1];
}
