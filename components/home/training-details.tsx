import { useSettings } from "@/app/settings";
import type { Account } from "@/components/auth/use-account";

export function TrainingDetails({
  account,
  onClose,
  onLogin,
}: {
  account: Account;
  onClose: () => void;
  onLogin: () => void;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const { user, busy, logout } = account;
  return (
    <>
      {" "}
      <p className="eyebrow">{t("準備はできています", "준비됐어요")}</p>
      <h2 id="home-dialog-title">
        {t("さあ、ひと勝負。", "자, 한 판 해볼까요.")}
      </h2>
      {user && <p className="description account-email">{user.email}</p>}
      <div className="rule-list">
        <p>
          <b className="life-rule">
            5 <span>♥</span>
          </b>
          <span>
            {t("ミス・時間切れでライフ−1", "오답·시간 초과 시 하트 −1")}
          </span>
        </p>
        <p>
          <b>10 → 2s</b>
          <span>{t("正答ごとに0.2秒ずつ加速", "정답마다 0.2초씩 가속")}</span>
        </p>
        <p>
          <b className="key-rule">
            <kbd>1</kbd>
            <kbd>2</kbd>
            <kbd>3</kbd>
            <kbd>4</kbd>
          </b>
          <span>{t("押した瞬間、打ち抜こう", "누르는 순간, 돌파하세요")}</span>
        </p>
      </div>
      <p className="dialog-explanation">
        {t(
          "数字キー・テンキー・タッチ・クリックに対応。意味問題と読み問題に答えて、読む力を鍛えましょう。",
          "숫자키·키패드·터치·클릭을 지원합니다. 의미와 읽기 문제를 풀며 단어 인식 속도를 높여보세요.",
        )}
      </p>
      <button className="primary" onClick={() => onClose()}>
        {t("わかりました", "확인했어요")}
        <span>✓</span>
      </button>
      {user ? (
        <button className="text-button" disabled={busy} onClick={logout}>
          {t("ログアウト", "로그아웃")}
        </button>
      ) : (
        <button className="text-button" onClick={() => onLogin()}>
          {t("ログイン・新規登録", "로그인 · 회원가입")}
        </button>
      )}
    </>
  );
}
