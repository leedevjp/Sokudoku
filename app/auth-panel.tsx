"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SettingsBar, useSettings } from "./settings";
export default function AuthPanel() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"login" | "signup">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [notice, setNotice] = useState<
      "sent" | "error" | "unconfirmed" | "rate" | "logout" | null
    >(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const client = createClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_e, s) => {
      if (active) {
        setUser(s?.user ?? null);
        setLoading(false);
      }
    });
    void client.auth
      .getUser()
      .then(({ data }) => {
        if (active) {
          setUser(data.user);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setNotice("error");
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const client = createClient();
      const { data, error } =
        mode === "signup"
          ? await client.auth.signUp({
              email: email.trim(),
              password,
              options: {
                emailRedirectTo: new URL(
                  "/auth/callback",
                  location.origin,
                ).toString(),
              },
            })
          : await client.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
      if (error)
        setNotice(
          error.code === "email_not_confirmed"
            ? "unconfirmed"
            : error.code?.includes("rate_limit")
              ? "rate"
              : "error",
        );
      else {
        if (data.session) setUser(data.user);
        else setNotice("sent");
        setPassword("");
      }
    } catch {
      setNotice("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) setNotice("error");
      else {
        setUser(null);
        setPassword("");
        setNotice("logout");
      }
    } catch {
      setNotice("error");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const notices = {
    sent: t(
      "確認メールを送信しました。同じブラウザーでリンクを開いてください。",
      "확인 메일을 보냈습니다. 같은 브라우저에서 링크를 열어주세요.",
    ),
    error: t(
      "認証に失敗しました。入力内容と接続を確認してください。",
      "인증에 실패했습니다. 입력 내용과 연결을 확인해주세요.",
    ),
    unconfirmed: t(
      "確認メールでメール認証を完了してください。",
      "확인 메일에서 이메일 인증을 완료해주세요.",
    ),
    rate: t(
      "しばらく待ってから再度お試しください。",
      "잠시 기다린 뒤 다시 시도해주세요.",
    ),
    logout: t("ログアウトしました。", "로그아웃했습니다."),
  };
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">速</span>Sokudoku
          <span className="brand-dot">.</span>
        </Link>
        <SettingsBar />
      </header>
      <div className="landing-grid">
        <section className="intro">
          <p className="eyebrow">
            {t(
              "ひと目でわかる。その先へ。",
              "보는 순간 이해하는, 그 다음으로.",
            )}
          </p>
          <h1>
            {t("知っている言葉を、", "아는 단어를,")}
            <br />
            <span>{t("瞬間のチカラに。", "순간의 실력으로.")}</span>
          </h1>
          <p className="description">
            {t(
              "意味をつかむ。読みがひらめく。",
              "뜻을 떠올리고, 읽기가 번뜩이는 순간.",
            )}
            <br />
            {t(
              "小さな反復で、日本語がもっと軽やかに。",
              "작은 반복으로 일본어를 더 가볍게.",
            )}
          </p>
          <div className="preview-stack" aria-hidden="true">
            <div className="preview-orbit" />
            <div className="preview-word">
              秋<span>あき</span>
            </div>
            <div className="preview-chip">
              {t("ひらめき、加速中。", "순간의 인식, 가속 중.")} ↗
            </div>
            <span className="spark s1">✦</span>
            <span className="spark s2">＋</span>
          </div>
          <div className="feature-row">
            <span>01 / {t("見て", "보고")}</span>
            <span>02 / {t("選んで", "고르고")}</span>
            <span>03 / {t("突き抜ける", "돌파하기")}</span>
          </div>
        </section>
        <section className="auth-card">
          {loading ? (
            <p role="status">
              {t("ログイン状態を確認中…", "로그인 상태 확인 중…")}
            </p>
          ) : user ? (
            <>
              <div className="card-icon">↗</div>
              <p className="eyebrow">{t("準備はできています", "준비됐어요")}</p>
              <h2>{t("さあ、ひと勝負。", "자, 한 판 해볼까요.")}</h2>
              <p className="description account-email">{user.email}</p>
              <div className="rule-list">
                <p>
                  <b>5 ♥</b>
                  <span>
                    {t("ミス・時間切れでライフ−1", "오답·시간 초과 시 하트 −1")}
                  </span>
                </p>
                <p>
                  <b>10 → 2s</b>
                  <span>
                    {t("正答ごとに0.2秒ずつ加速", "정답마다 0.2초씩 가속")}
                  </span>
                </p>
                <p>
                  <b>1 2 / 3 4</b>
                  <span>
                    {t(
                      "押して、離して、打ち抜こう",
                      "누르고, 떼서, 돌파하세요",
                    )}
                  </span>
                </p>
              </div>
              <Link className="primary link-button" href="/game">
                {t("トレーニングを始める", "훈련 시작하기")} <span>→</span>
              </Link>
              <button className="text-button" disabled={busy} onClick={logout}>
                {t("ログアウト", "로그아웃")}
              </button>
            </>
          ) : (
            <>
              <div className="card-icon">↗</div>
              <h2>
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
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
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
                      ? t("ログインして始める", "로그인하고 시작하기")
                      : t(
                          "登録して確認メールを受け取る",
                          "가입하고 인증 메일 받기",
                        )}{" "}
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
          )}
          {notice && (
            <p className="notice" role="status" aria-live="polite">
              {notices[notice]}
            </p>
          )}
        </section>
      </div>
      <footer>
        速読 /{" "}
        {t("毎日の「わかった」を、もっと速く。", "매일의 이해를, 더 빠르게.")}
        <span>MADE FOR YOUR MOMENT.</span>
      </footer>
    </main>
  );
}
