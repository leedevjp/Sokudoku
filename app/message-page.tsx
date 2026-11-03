"use client";
import Link from "next/link";
import { SettingsBar } from "@/components/settings/settings-bar";
import { useSettings } from "@/components/settings/settings-provider";
export default function MessagePage({ kind }: { kind: "auth" | "missing" }) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <SettingsBar />
        <p className="eyebrow" style={{ marginTop: 24 }}>
          SOKUDOKU
        </p>
        <h2>
          {kind === "auth"
            ? t(
                "自動ログインを完了できませんでした。",
                "자동 로그인을 완료하지 못했어요.",
              )
            : t("ページが見つかりません。", "페이지를 찾을 수 없어요.")}
        </h2>
        <p className="description">
          {kind === "auth"
            ? t(
                "メール認証が済んでいても、別のブラウザーでリンクを開くと自動ログインできない場合があります。登録したメールアドレスとパスワードでログインしてください。未認証と表示される場合は、確認メールのリンクが期限切れ・使用済みでないか確認してください。",
                "이메일 인증이 완료됐어도 다른 브라우저에서 링크를 열면 자동 로그인이 안 될 수 있어요. 가입한 이메일과 비밀번호로 로그인해보세요. 미인증 안내가 나오면 확인 메일 링크가 만료되었거나 이미 사용됐는지 확인해주세요.",
              )
            : t(
                "URLを確認するか、ホームに戻ってください。",
                "주소를 확인하거나 홈으로 돌아가세요.",
              )}
        </p>
        <Link className="primary" href={kind === "auth" ? "/?login=1" : "/"}>
          {kind === "auth"
            ? t("ログインへ", "로그인하기")
            : t("ホームに戻る", "홈으로 돌아가기")}{" "}
          →
        </Link>
      </section>
    </main>
  );
}
