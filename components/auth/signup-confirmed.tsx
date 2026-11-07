"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SettingsBar } from "@/components/settings/settings-bar";
import { useSettings } from "@/components/settings/settings-provider";
import { createClient } from "@/lib/supabase/client";
import { createSignupClient } from "@/lib/supabase/signup";
import { confirmSignup, pendingSignup, SIGNUP_PENDING_KEY, type ConfirmationResult } from "@/lib/auth/signup-confirmation";

export default function SignupConfirmed() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => prefs.lang === "jp" ? jp : kr;
  const [result, setResult] = useState<ConfirmationResult | "loading">("loading");
  const work = useRef<Promise<ConfirmationResult> | null>(null);
  useEffect(() => {
    let active = true;
    if (!work.current) {
      // Strip bearer credentials before any asynchronous work or navigation.
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      window.history.replaceState(null, "", url.pathname + url.search);
      const state = url.searchParams.get("state") ?? "";
      const receipt = "signup-confirmed-v1:" + state;
      work.current = (async () => {
        let storage: Storage | null = null;
        try { storage = localStorage; } catch { /* Manual login still works. */ }
        try {
          if (!fragment.size && state && sessionStorage.getItem(receipt) === "confirmed") return "confirmed";
        } catch { /* Storage is optional. */ }
        const outcome = await confirmSignup(fragment, createSignupClient().auth,
          createClient().auth, pendingSignup(storage, state), url.searchParams.get("legacy") === "1");
        if (outcome === "confirmed" || outcome === "signed-in") {
          try {
            if (state) sessionStorage.setItem(receipt, "confirmed");
            if (pendingSignup(storage, state)) storage?.removeItem(SIGNUP_PENDING_KEY);
          } catch { /* Storage is optional. */ }
        }
        return outcome;
      })().catch(() => "service" as const);
    }
    void work.current.then((outcome) => { if (active) setResult(outcome); });
    return () => { active = false; };
  }, []);
  const success = result === "confirmed" || result === "signed-in";
  return <main className="auth-shell"><section className="auth-card">
    <SettingsBar />
    <p className="eyebrow" style={{ marginTop: 24 }}>SOKUDOKU</p>
    <div role="status" aria-live="polite">
      <h2>{result === "loading" ? t("メール認証を確認しています…", "이메일 인증을 확인하고 있어요…")
        : success ? t("メール認証が完了しました。", "이메일 인증이 완료됐어요.")
        : result === "check-login" ? t("登録したブラウザーでログインしてください。", "가입했던 브라우저에서 로그인해주세요.")
        : result === "service" ? t("接続を確認してください。", "연결을 확인해주세요.")
        : t("認証リンクを確認できませんでした。", "인증 링크를 확인할 수 없어요.")}</h2>
      <p className="description">{result === "loading" ? t("少々お待ちください。", "잠시만 기다려주세요.")
        : result === "signed-in" ? t("ログインも完了しました。このまま始められます。", "로그인도 완료됐어요. 바로 시작할 수 있어요.")
        : success ? t("登録したブラウザーに戻り、メールアドレスとパスワードでログインしてください。このブラウザーでログインすることもできます。", "가입했던 브라우저로 돌아가 이메일과 비밀번호로 로그인해주세요. 이 브라우저에서 로그인해도 됩니다.")
        : result === "check-login" ? t("このリンクでは認証状態を確認できませんでした。メールアドレスとパスワードでログインし、未認証と表示されたら確認メールを再送してください。", "이 링크에서는 인증 상태를 확인하지 못했어요. 이메일과 비밀번호로 로그인해보고, 미인증 안내가 나오면 인증 메일을 다시 받아주세요.")
        : result === "service" ? t("接続が安定してから、メール内のリンクをもう一度開いてください。", "연결이 안정된 뒤 메일의 링크를 다시 열어주세요.")
        : t("リンクが期限切れ、または使用済みの可能性があります。認証済みならログインし、未認証ならログイン画面から確認メールを再送してください。", "링크가 만료됐거나 이미 사용됐을 수 있어요. 인증을 마쳤다면 로그인하고, 미인증이라면 로그인 화면에서 인증 메일을 다시 받아주세요.")}</p>
    </div>
    {result !== "loading" && <Link className="primary" href={result === "signed-in" ? "/" : "/?login=1"}>
      {result === "signed-in" ? t("はじめる", "시작하기") : t("ログインへ", "로그인하기")} →
    </Link>}
  </section></main>;
}
