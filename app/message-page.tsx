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
                "認証リンクを確認できませんでした。",
                "인증 링크를 확인할 수 없어요.",
              )
            : t("ページが見つかりません。", "페이지를 찾을 수 없어요.")}
        </h2>
        <p className="description">
          {kind === "auth"
            ? t(
                "リンクが期限切れ、または使用済みの可能性があります。認証済みならメールアドレスとパスワードでログインしてください。未認証と表示されたら、ログイン画面で確認メールを再送できます。",
                "링크가 만료됐거나 이미 사용됐을 수 있어요. 인증을 마쳤다면 이메일과 비밀번호로 로그인해주세요. 미인증 안내가 나오면 로그인 화면에서 인증 메일을 다시 받을 수 있어요.",
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
