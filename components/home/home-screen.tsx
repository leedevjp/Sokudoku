"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SettingsBar, useSettings } from "@/app/settings";
import {
  defaultLevels,
  trainingKinds,
  parseKinds,
  trainingLevels,
  parseLevels,
  type TrainingLevel,
} from "@/lib/game/selection";
import { useAccount } from "@/components/auth/use-account";
import { AuthForm } from "@/components/auth/auth-form";
import { HomeHero } from "./home-hero";
import { Modal } from "@/components/ui/modal";
import { TrainingDetails } from "./training-details";
import type { Kind } from "@/lib/game/types";
import { KindSelector } from "./kind-selector";
import { LevelSelector } from "./level-selector";

export default function HomeScreen() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const [modal, setModal] = useState<"details" | "auth" | null>(null);
  const authenticated = useCallback(
    () => setModal((current) => (current === "auth" ? null : current)),
    [],
  );
  const account = useAccount(authenticated);
  const { user, loading, notice } = account;
  const [levels, setLevels] = useState<TrainingLevel[]>(defaultLevels);
  const [kinds, setKinds] = useState<Kind[]>(trainingKinds);
  const canStart = levels.length > 0 && kinds.length > 0;
  useEffect(() => {
    // Restore after hydration so the first server/client render stays identical.
    const timer = setTimeout(() => {
      try {
        const savedKinds = localStorage.getItem("sokudoku-kinds-v1");
        if (savedKinds !== null) setKinds(parseKinds(savedKinds));
        const saved = localStorage.getItem("sokudoku-levels-v1");
        if (saved !== null) setLevels(parseLevels(saved));
      } catch {
        /* Optional preference. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function toggleLevel(level: TrainingLevel) {
    const next = trainingLevels.filter((item) =>
      item === level ? !levels.includes(item) : levels.includes(item),
    );
    setLevels(next);
    try {
      localStorage.setItem("sokudoku-levels-v1", next.join(","));
    } catch {
      /* Optional preference. */
    }
  }
  function toggleKind(kind: Kind) {
    const next = trainingKinds.filter((item) =>
      item === kind ? !kinds.includes(item) : kinds.includes(item),
    );
    setKinds(next);
    try {
      localStorage.setItem("sokudoku-kinds-v1", next.join(","));
    } catch {
      /* Optional preference. */
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
      <HomeHero />
      <div className="home-actions">
        <KindSelector kinds={kinds} onToggle={toggleKind} />
        <LevelSelector levels={levels} onToggle={toggleLevel} />
        {loading ? (
          <button className="primary" disabled>
            {t("ログイン状態を確認中…", "로그인 상태 확인 중…")}
          </button>
        ) : user ? (
          <Link
            className="primary"
            aria-disabled={!canStart}
            href={`/game?levels=${encodeURIComponent(levels.join(","))}&kinds=${encodeURIComponent(kinds.join(","))}`}
            onClick={(event) => {
              if (!canStart) event.preventDefault();
            }}
          >
            {t("トレーニングを始める", "훈련 시작하기")}
            <span>→</span>
          </Link>
        ) : (
          <button
            className="primary"
            disabled={!canStart}
            onClick={() => setModal("auth")}
          >
            {t("ログインして始める", "로그인하고 시작하기")}
            <span>→</span>
          </button>
        )}
        <div className="home-secondary-actions">
          <Link
            className="notebook-link"
            href="/notebook"
            onClick={(event) => {
              if (!user) {
                event.preventDefault();
                setModal("auth");
              }
            }}
          >
            <span aria-hidden="true">▤</span> {t("まちがいノート", "오답노트")}
            <span aria-hidden="true">↗</span>
          </Link>
          <button
            className="details-button"
            onClick={() => setModal("details")}
          >
            {t("遊び方・アカウント", "상세 설명 · 계정")}
            <span>↗</span>
          </button>
        </div>
        {notice && modal === null && (
          <p className="home-notice" role="status">
            {notices[notice]}
          </p>
        )}
      </div>
      <footer>
        {t("毎日の「わかった」を、もっと速く。", "매일의 이해를, 더 빠르게.")}
      </footer>
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        titleId="home-dialog-title"
      >
        {modal === "details" ? (
          <TrainingDetails
            account={account}
            onClose={() => setModal(null)}
            onLogin={() => setModal("auth")}
          />
        ) : (
          <AuthForm account={account} />
        )}
        {notice && modal !== null && (
          <p className="notice" role="status" aria-live="polite">
            {notices[notice]}
          </p>
        )}
      </Modal>
    </main>
  );
}
