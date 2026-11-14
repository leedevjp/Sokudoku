"use client";
import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { SettingsBar } from "@/components/settings/settings-bar";
import { useSettings } from "@/components/settings/settings-provider";
import { useAccount } from "@/components/auth/use-account";
import { AuthForm } from "@/components/auth/auth-form";
import { HomeHero } from "./home-hero";
import { Modal } from "@/components/ui/modal";
import { ModeSelector } from "./mode-selector";
import { KindSelector } from "./kind-selector";
import { LevelSelector } from "./level-selector";
import { DeploymentLabel } from "@/components/deployment/deployment-watcher";
import { useFolderOutline } from "./use-folder-outline";
import { useTrainingSelection } from "./use-training-selection";
import { useHomeSheen } from "./use-home-sheen";

export default function HomeScreen() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const [modal, setModal] = useState<"auth" | null>(null);
  const authenticated = useCallback(
    () => setModal((current) => (current === "auth" ? null : current)),
    [],
  );
  const account = useAccount(authenticated);
  const { user, loading, notice } = account;
  const {
    levels, kinds, modes, timeLimited, selectionReady, activeFolder, kanaOnly,
    canStart, toggleLevel, toggleKind, toggleMode, changeTimeLimit,
  } = useTrainingSelection(user?.id, loading);
  const homeActionsRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const { folderRef, folderOutline } = useFolderOutline(modes, prefs.lang);
  useHomeSheen(homeActionsRef, sheenRef, modes, levels, kinds, loading, user?.id);
  useLayoutEffect(() => {
    if (new URLSearchParams(window.location.search).get("login") === "1") {
      // Restore an explicit URL request before paint, once on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModal("auth");
    }
  }, []);

  const notices = {
    sent: t(
      "確認メールを送信しました。どのブラウザーでリンクを開いても認証できます。認証後、メールアドレスとパスワードでログインしてください。",
      "인증 메일을 보냈습니다. 다른 브라우저에서 링크를 열어도 인증할 수 있어요. 인증 후 이메일과 비밀번호로 로그인해주세요.",
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
        <div className="home-header-actions">
          {user && (
            <button
              className="logout-button"
              disabled={account.busy}
              onClick={account.logout}
              aria-label={t("ログアウト", "로그아웃")}
              title={t("ログアウト", "로그아웃")}
            >
              Logout
            </button>
          )}
          <SettingsBar />
        </div>
      </header>
      <HomeHero authenticated={!!user} />
      <div className="home-actions" ref={homeActionsRef}>
        <div className="home-sheen-stage" ref={sheenRef} aria-hidden="true" />
        <section
          ref={folderRef}
          className={`home-mode-folder folder-${activeFolder}${folderOutline ? " outline-ready" : ""}`}
          style={{ visibility: selectionReady ? "visible" : "hidden" }}
          aria-label={t("学習設定", "학습 설정")}
        >
          {folderOutline && (
            <svg
              className="home-folder-outline"
              viewBox={`0 0 ${folderOutline.width} ${folderOutline.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path d={folderOutline.d} />
            </svg>
          )}
          <div className="home-folder-tabs">
            <ModeSelector
              modes={modes}
              onToggle={toggleMode}
              timeLimited={timeLimited}
              onTimeLimitChange={changeTimeLimit}
            />
          </div>
          <div className="home-folder-body">
            {!modes.length && (
              <p className="level-hint" role="status">
                {t("学習モードを選んでください。", "학습 모드를 선택해주세요.")}
              </p>
            )}
            <div className="home-setting-group">
              <KindSelector kinds={kinds} onToggle={toggleKind} />
            </div>
            <div className="home-setting-group">
              <LevelSelector levels={levels} onToggle={toggleLevel} />
            </div>
            {kanaOnly && !kinds.includes("meaning") && (
              <p className="level-hint" role="status">
                {t(
                  "かなの学習には「意味」を選んでください。",
                  "가나를 학습하려면 뜻 맞추기를 선택해주세요.",
                )}
              </p>
            )}
            <div className="home-launch-group">
              {loading ? (
                <button className="primary" disabled>
                  {t("ログイン状態を確認中…", "로그인 상태 확인 중…")}
                </button>
              ) : user ? (
                <Link
                  className="primary"
                  aria-disabled={!canStart}
                  href={`/game?levels=${encodeURIComponent(levels.join(","))}&kinds=${encodeURIComponent(kinds.join(","))}&modes=${encodeURIComponent(modes.join(","))}&timeLimit=${timeLimited ? "on" : "off"}`}
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
            </div>
          </div>
        </section>
        <nav
          className="home-secondary-actions"
          aria-label={t("学習メニュー", "학습 메뉴")}
        >
          {/* Temporarily hidden while sentence quiz data is being edited.
          <Link className="notebook-link" href={`/sentence?levels=${levels.filter(level=>['1','2','3','4','5'].includes(level)).join(',')}`}>{t('文章を読む','문장 읽기')} ↗</Link>
          */}
          <Link
            className="notebook-link"
            href="/dashboard"
            onClick={(event) => {
              if (!user) {
                event.preventDefault();
                setModal("auth");
              }
            }}
          >
            <span aria-hidden="true">▥</span>
            <span>{t("学習状況", "학습 현황")}</span>
          </Link>
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
            <span aria-hidden="true">▤</span>
            <span>{t("まちがいノート", "오답노트")}</span>
          </Link>
          <Link className="notebook-link" href="/personal">
            <span aria-hidden="true">▣</span>
            <span>{t("マイ単語帳", "내 단어장")}</span>
          </Link>
        </nav>
        {notice && modal === null && (
          <p className="home-notice" role="status">
            {notices[notice]}
          </p>
        )}
      </div>
      <footer>
        {t("毎日の「わかった」を、もっと速く。", "매일의 이해를, 더 빠르게.")}
      </footer>
      <DeploymentLabel lang={prefs.lang} />
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        titleId="home-dialog-title"
      >
        <AuthForm account={account} />
        {notice && modal !== null && (
          <p className="notice" role="status" aria-live="polite">
            {notices[notice]}
          </p>
        )}
      </Modal>
    </main>
  );
}
