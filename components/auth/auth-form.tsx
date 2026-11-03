import { useSettings } from "@/app/settings";
import type { Account } from "./use-account";

export function AuthForm({ account }: { account: Account }) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    busy,
    setNotice,
    submit,
  } = account;
  return (
    <>
      {" "}
      <p className="eyebrow">SOKUDOKU</p>
      <h2 id="home-dialog-title">
        {mode === "login"
          ? t("おかえりなさい", "다시 만나 반가워요")
          : t("はじめの一歩を", "첫 걸음을 시작해요")}
      </h2>
      <p className="description">
        {t(
          "自分のペースで、少しずつ速く。",
          "나만의 속도로, 조금씩 더 빠르게.",
        )}
      </p>
      <div className="auth-tabs">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            aria-pressed={m === mode}
            disabled={busy}
            onClick={() => {
              setMode(m);
              setNotice(null);
              setPassword("");
            }}
          >
            {m === "login"
              ? t("ログイン", "로그인")
              : t("新規登録", "회원가입")}
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        <label htmlFor="email">{t("メールアドレス", "이메일")}</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          maxLength={254}
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password">{t("パスワード", "비밀번호")}</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={t("8文字以上", "8자 이상")}
          minLength={8}
          required
          value={password}
          disabled={busy}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="primary" disabled={busy}>
          {busy
            ? t("処理中…", "처리 중…")
            : mode === "login"
              ? t("ログイン", "로그인")
              : t("登録して確認メールを受け取る", "가입하고 인증 메일 받기")}
          <span>→</span>
        </button>
      </form>
      <p className="footnote">
        {t(
          "新規登録後はメール認証が必要です。",
          "회원가입 후 이메일 인증이 필요합니다.",
        )}
      </p>
    </>
  );
}
