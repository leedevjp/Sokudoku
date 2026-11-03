"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SettingsBar, useSettings } from "./settings";
import { defaultLevels, trainingLevels, levelDifficulty, parseLevels, type TrainingLevel } from "@/lib/game/selection";
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
  const [levels, setLevels] = useState<TrainingLevel[]>(defaultLevels);
  function toggleLevel(level: TrainingLevel) {
    const next = trainingLevels.filter(item => item === level ? !levels.includes(item) : levels.includes(item));
    setLevels(next);
    try { localStorage.setItem("sokudoku-levels-v1", next.join(",")); } catch { /* Optional preference. */ }
  }
  const [modal, setModal] = useState<"details" | "auth" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (modal) {
      if (!element.open) element.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    if (element.open) element.close();
  }, [modal]);
  useEffect(() => {
    let active = true;
    const client = createClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_e, s) => {
      if (active) {
        setUser(s?.user ?? null);
        if (s?.user) setModal(current => current === "auth" ? null : current);
        setLoading(false);
      }
    });
    void client.auth
      .getUser()
      .then(({ data }) => {
        if (active) {
          try {
            const saved = localStorage.getItem("sokudoku-levels-v1");
            if (saved !== null) setLevels(parseLevels(saved));
          } catch { /* Storage can be unavailable. */ }
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
        if (data.session) { setUser(data.user); setModal(null); }
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
    <main className="site-shell home-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">速</span>Sokudoku
          <span className="brand-dot">.</span>
        </Link>
        <SettingsBar />
      </header>
      <section className="home-content">
        <p className="eyebrow">
          {t("ひと目でわかる。その先へ。", "보는 순간 이해하는, 그 다음으로.")}
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
        <div className="preview-stack home-visual" aria-hidden="true">
          <span className="spark s1">✦</span>
          <span className="spark s2">✦</span>
          <div className="preview-target">
            <i className="corner tl" />
            <i className="corner tr" />
            <i className="corner bl" />
            <i className="corner br" />
            <div className="preview-word">
              <span className="preview-kind">
                <i />
                {t("意味", "의미")}
              </span>
              <strong>兄</strong>
              <span className="preview-reading">あに</span>
            </div>
          </div>
          <div className="preview-answer">
            <span>1</span>
            <b>형(형, 오빠)</b>
            <i>↗</i>
          </div>
        </div>
      </section>
      <div className="home-actions">
        <div className="training-levels" role="group" aria-label={t("出題範囲（複数選択可）", "출제 범위 (복수 선택 가능)")}>
          {trainingLevels.map(level => (
            <button key={level} type="button" aria-pressed={levels.includes(level)}
              title={level === "P" ? t("個人単語", "개인 단어") : `${t("難易度", "난이도")} ${levelDifficulty[level].join(", ")}`}
              aria-label={level === "P" ? t("個人単語", "개인 단어") : `${level}: ${t("難易度", "난이도")} ${levelDifficulty[level].join(", ")}`}
              onClick={() => toggleLevel(level)}>{level}</button>
          ))}
        </div>
        {levels.length === 0 && <p className="level-hint" role="status">{t("出題範囲を選んでください。", "출제 범위를 선택해주세요.")}</p>}
        {loading ? (
          <button className="primary" disabled>
            {t("ログイン状態を確認中…", "로그인 상태 확인 중…")}
          </button>
        ) : user ? (
          <Link className="primary" aria-disabled={!levels.length} href={`/game?levels=${encodeURIComponent(levels.join(","))}`} onClick={event => { if (!levels.length) event.preventDefault(); }}>
            {t("トレーニングを始める", "훈련 시작하기")}
            <span>→</span>
          </Link>
        ) : (
          <button className="primary" onClick={() => setModal("auth")}>
            {t("ログインして始める", "로그인하고 시작하기")}
            <span>→</span>
          </button>
        )}
        <button className="details-button" onClick={() => setModal("details")}>
          {t("遊び方・アカウント", "상세 설명 · 계정")}
          <span>↗</span>
        </button>
        {notice && modal === null && (
          <p className="home-notice" role="status">
            {notices[notice]}
          </p>
        )}
      </div>
      <footer>
        {t("毎日の「わかった」を、もっと速く。", "매일의 이해를, 더 빠르게.")}
      </footer>
      <dialog
        ref={dialog}
        className="home-dialog"
        aria-labelledby="home-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          setModal(null);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            setModal(null);
        }}
      >
        <div className="dialog-content">
          <button
            className="dialog-close"
            autoFocus
            aria-label={t("閉じる", "닫기")}
            onClick={() => setModal(null)}
          >
            ×
          </button>
          {modal === "details" ? (
            <>
              <p className="eyebrow">{t("準備はできています", "준비됐어요")}</p>
              <h2 id="home-dialog-title">
                {t("さあ、ひと勝負。", "자, 한 판 해볼까요.")}
              </h2>
              {user && (
                <p className="description account-email">{user.email}</p>
              )}
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
                  <span>
                    {t("正答ごとに0.2秒ずつ加速", "정답마다 0.2초씩 가속")}
                  </span>
                </p>
                <p>
                  <b className="key-rule">
                    <kbd>1</kbd>
                    <kbd>2</kbd>
                    <kbd>3</kbd>
                    <kbd>4</kbd>
                  </b>
                  <span>
                    {t("押した瞬間、打ち抜こう", "누르는 순간, 돌파하세요")}
                  </span>
                </p>
              </div>
              <p className="dialog-explanation">
                {t(
                  "数字キー・テンキー・タッチ・クリックに対応。意味問題と読み問題に答えて、読む力を鍛えましょう。",
                  "숫자키·키패드·터치·클릭을 지원합니다. 의미와 읽기 문제를 풀며 단어 인식 속도를 높여보세요.",
                )}
              </p>
              <button className="primary" onClick={() => setModal(null)}>
                {t("わかりました", "확인했어요")}
                <span>✓</span>
              </button>
              {user ? (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={logout}
                >
                  {t("ログアウト", "로그아웃")}
                </button>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setModal("auth")}
                >
                  {t("ログイン・新規登録", "로그인 · 회원가입")}
                </button>
              )}
            </>
          ) : (
            <>
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
                      ? t("ログイン", "로그인")
                      : t(
                          "登録して確認メールを受け取る",
                          "가입하고 인증 메일 받기",
                        )}
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
          {notice && modal !== null && (
            <p className="notice" role="status" aria-live="polite">
              {notices[notice]}
            </p>
          )}
        </div>
      </dialog>
    </main>
  );
}
