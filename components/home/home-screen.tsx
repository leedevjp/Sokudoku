"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsBar } from "@/components/settings/settings-bar";
import { useSettings } from "@/components/settings/settings-provider";
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
import type { Kind } from "@/lib/game/types";
import { ModeSelector } from "./mode-selector";
import {
  parseModes,
  defaultTrainingModes,
  toggleTrainingMode,
  type TrainingMode,
} from "@/lib/game/learning/types";
import { KindSelector } from "./kind-selector";
import { LevelSelector } from "./level-selector";
import { DeploymentLabel } from "@/components/deployment/deployment-watcher";

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
  const [levels, setLevels] = useState<TrainingLevel[]>(defaultLevels);
  const [kinds, setKinds] = useState<Kind[]>(trainingKinds);
  const [modes, setModes] = useState<TrainingMode[]>(defaultTrainingModes);
  const [timeLimited, setTimeLimited] = useState(false);
  const isAuto = modes.includes("auto");
  const homeActionsRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const kanaOnly =
    levels.length > 0 &&
    levels.every((level) => level === "H" || level === "K");
  const canStart =
    levels.length > 0 &&
    kinds.length > 0 &&
    modes.length > 0 &&
    (!kanaOnly || kinds.includes("meaning"));
  useEffect(() => {
    // Restore after hydration so the first server/client render stays identical.
    const timer = setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("login") === "1") {
        setModal("auth");
      }
      try {
        const savedTimeLimit = localStorage.getItem("sokudoku-time-limit-v1");
        if (savedTimeLimit !== null) setTimeLimited(savedTimeLimit !== "off");
        const savedModes = localStorage.getItem("sokudoku-modes-v1");
        if (savedModes !== null) setModes(parseModes(savedModes));
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
  useEffect(() => {
    if (!isAuto) return;
    const home = homeActionsRef.current;
    const sheen = sheenRef.current;
    if (!home || !sheen) return;

    // All selected buttons reveal the same animated light beam. Their rounded
    // rectangles form one clip-path in home-relative coordinates, so the beam
    // moves across the whole UI at precisely the same speed and phase.
    const round = (value: number) => Math.round(value * 10) / 10;
    const updateSheenMask = () => {
      const area = home.getBoundingClientRect();
      home.style.setProperty("--omakase-stage-width", `${round(area.width)}px`);
      const selected = home.querySelectorAll<HTMLElement>(
        '.training-levels button[aria-pressed="true"], .home-launch-group .primary:not(:disabled):not([aria-disabled="true"])',
      );
      const paths = Array.from(selected, (button) => {
        const rect = button.getBoundingClientRect();
        const x = round(rect.left - area.left);
        const y = round(rect.top - area.top);
        const w = round(rect.width);
        const h = round(rect.height);
        const r = round(Math.min(13, w / 2, h / 2));
        return [
          `M ${round(x + r)} ${y}`,
          `H ${round(x + w - r)}`,
          `Q ${round(x + w)} ${y} ${round(x + w)} ${round(y + r)}`,
          `V ${round(y + h - r)}`,
          `Q ${round(x + w)} ${round(y + h)} ${round(x + w - r)} ${round(y + h)}`,
          `H ${round(x + r)}`,
          `Q ${x} ${round(y + h)} ${x} ${round(y + h - r)}`,
          `V ${round(y + r)}`,
          `Q ${x} ${y} ${round(x + r)} ${y} Z`,
        ].join(" ");
      });
      sheen.style.clipPath = paths.length ? `path("${paths.join(" ")}")` : "inset(100%)";
    };

    const observer = new ResizeObserver(updateSheenMask);
    observer.observe(home);
    for (const button of home.querySelectorAll<HTMLElement>(
      ".training-levels button, .home-launch-group .primary",
    )) observer.observe(button);
    window.addEventListener("resize", updateSheenMask);
    updateSheenMask();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSheenMask);
    };
  }, [isAuto, levels, kinds, loading, user]);

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
  function toggleMode(mode: TrainingMode) {
    const next = toggleTrainingMode(modes, mode);
    if (mode === "auto" && next.includes("auto")) {
      // Omakase starts unrestricted, then respects any manual deselection.
      setLevels([...trainingLevels]);
      setKinds([...trainingKinds]);
      try {
        localStorage.setItem("sokudoku-levels-v1", trainingLevels.join(","));
        localStorage.setItem("sokudoku-kinds-v1", trainingKinds.join(","));
      } catch { /* Optional preference. */ }
    }
    setModes(next);
    try {
      localStorage.setItem("sokudoku-modes-v1", next.join(","));
    } catch {
      /* Optional preference. */
    }
  }
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
      <div className={`home-actions${isAuto ? " home-auto" : ""}`} ref={homeActionsRef}>
        {isAuto && <div className="omakase-sheen-stage" ref={sheenRef} aria-hidden="true" />}
        <div className="home-setting-group">
          <ModeSelector modes={modes} onToggle={toggleMode} timeLimited={timeLimited} onTimeLimitChange={(value) => { setTimeLimited(value); try { localStorage.setItem("sokudoku-time-limit-v1", value ? "on" : "off"); } catch { /* Optional preference. */ } }} />
        </div>
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
          <div className="home-secondary-actions">
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
              <span aria-hidden="true">▥</span> {t("学習状況", "학습 현황")}{" "}
              <span aria-hidden="true">↗</span>
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
              <span aria-hidden="true">▤</span>{" "}
              {t("まちがいノート", "오답노트")}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
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
