"use client";
import Link from "next/link";
import { SettingsBar, useSettings } from "./settings";
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
            ? t("認証を完了できませんでした。", "인증을 완료하지 못했어요.")
            : t("ページが見つかりません。", "페이지를 찾을 수 없어요.")}
        </h2>
        <p className="description">
          {kind === "auth"
            ? t(
                "リンクの有効期限が切れているか、すでに使用されている可能性があります。登録したブラウザーで確認メールを開き直してください。",
                "링크가 만료되었거나 이미 사용되었을 수 있어요. 가입한 브라우저에서 확인 메일을 다시 열어주세요.",
              )
            : t(
                "URLを確認するか、ホームに戻ってください。",
                "주소를 확인하거나 홈으로 돌아가세요.",
              )}
        </p>
        <Link className="primary" href="/">
          {t("ホームに戻る", "홈으로 돌아가기")} →
        </Link>
      </section>
    </main>
  );
}
