"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import { SettingsBar } from "@/components/settings/settings-bar";
import type { ReadingSentence, SentenceSocket } from "@/lib/sentence/content";
import styles from "./sentence.module.css";

type Question = { sentence: ReadingSentence; socket: SentenceSocket };
const REVIEW_MS = 3500;
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function deck(sentences: ReadingSentence[]): Question[] {
  return shuffle(sentences).map(sentence => {
    const socket = sentence.sockets[Math.floor(Math.random() * sentence.sockets.length)];
    const accepted = shuffle(socket.options.filter(o => o.accepted));
    const rejected = shuffle(socket.options.filter(o => !o.accepted));
    const remainder = shuffle([...accepted.slice(1), ...rejected.slice(1)]).slice(0, 2);
    return { sentence, socket: { ...socket, options: shuffle([accepted[0], rejected[0], ...remainder]) } };
  });
}
export default function SentenceGame({ sentences }: { sentences: ReadingSentence[] }) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => prefs.lang === "jp" ? jp : kr;
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ratio, setRatio] = useState(1);
  const remaining = useRef(REVIEW_MS);
  const guard = useRef(false);
  const readingRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLParagraphElement>(null);
  const q = questions?.[index];
  const done = questions !== null && index >= questions.length;
  const answered = selected !== null;

  useEffect(() => {
    const timer = setTimeout(() => setQuestions(deck(sentences)), 0);
    return () => clearTimeout(timer);
  }, [sentences]);
  function advance() {
    if (!guard.current) return;
    guard.current = false;
    remaining.current = REVIEW_MS;
    setRatio(1); setIndex(i => i + 1); setSelected(null); setPaused(false);
  }
  function choose(i: number) {
    if (!q || guard.current || paused) return;
    guard.current = true;
    remaining.current = REVIEW_MS;
    setRatio(1); setSelected(i);
    if (q.socket.options[i].accepted) setCorrect(n => n + 1);
  }
  // Like the word game's correction clock: paused time never consumes review time.
  useEffect(() => {
    if (selected === null || paused) return;
    let previous = performance.now();
    let frame: number;
    const tick = (now: number) => {
      remaining.current = Math.max(0, remaining.current - (now - previous));
      previous = now;
      setRatio(remaining.current / REVIEW_MS);
      if (remaining.current === 0) advance();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [selected, paused]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) setPaused(true); };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !q) return;
      if (event.code === "Space") { event.preventDefault(); setPaused(p => !p); }
      else if (/^[1-4]$/.test(event.key)) {
        const i = Number(event.key) - 1;
        if (selected === null) choose(i);
        else if (q.socket.options[i].accepted) advance();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    const area = readingRef.current, text = sentenceRef.current;
    if (!area || !text) return;
    const fit = () => {
      let size = Math.min(32, Math.max(22, area.clientWidth / 16));
      text.style.fontSize = `${size}px`;
      while (text.scrollHeight > area.clientHeight && size > 12) {
        size -= .5; text.style.fontSize = `${size}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(area); fit();
    void document.fonts.ready.then(() => { if (text.isConnected) fit(); });
    return () => observer.disconnect();
  }, [q, selected]);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/"><span>速</span>Sokudoku<b>.</b></Link>
      <div className={styles.headerActions}><SettingsBar /><button className={styles.iconButton} onClick={() => setPaused(p => !p)} aria-label={paused ? t("再開", "재개") : t("一時停止", "일시정지")}>{paused ? "▶" : "Ⅱ"}</button></div>
    </header>
    <div className={styles.topline}>
      <div className={styles.score}><span>{t("正答", "정답")}</span><strong>{correct}</strong></div>
      <div className={styles.position}><strong>{questions ? Math.min(index + 1, questions.length) : 0}</strong><span>/ {questions?.length ?? "…"}</span></div>
    </div>
    <progress className={styles.progress} max={questions?.length || 1} value={index} aria-label={t("進み具合", "진행 상황")} />
    {!questions ? <p role="status">{t("準備中…", "준비 중…")}</p> : done ?
      <section className={styles.card}>
        <p className={styles.eyebrow}>READING COMPLETE</p>
        <h1>{questions.length ? t("おつかれさま！", "수고했어요!") : t("文章がありません", "준비된 문장이 없어요")}</h1>
        <p>{t("読んだ文章", "읽은 문장")} {index} · {t("正答", "정답")} {correct}</p>
        <button className={styles.action} onClick={() => { guard.current = false; remaining.current = REVIEW_MS; setRatio(1); setQuestions(deck(sentences)); setIndex(0); setSelected(null); setCorrect(0); setPaused(false); }}>{t("もう一度", "다시 읽기")}</button>
        <Link href="/">{t("ホームへ", "홈으로")}</Link>
      </section> : q ? <>
        <div className={styles.badges}><span>● {t("文章", "문장")}</span><span>{t("読解", "독해")}</span></div>
        <section className={styles.card} aria-label={t("問題", "문제")}>
          <p className={styles.eyebrow}>{t("文脈に合う言葉を選ぼう", "문맥에 맞는 표현을 골라주세요")}</p>
          <div className={styles.reading} ref={readingRef}><p ref={sentenceRef} lang="ja" className={styles.sentence}>
            {q.sentence.text.slice(0, q.socket.start)}<mark className={styles.blank}>{selected === null ? "（　）" : q.socket.options[selected].accepted ? q.socket.options[selected].text : q.socket.original}</mark>{q.sentence.text.slice(q.socket.start + q.socket.original.length)}
          </p></div>
        </section>
        {selected === null ? <div className={styles.choices}>{q.socket.options.map((o, i) =>
          <button key={i} disabled={paused} onClick={() => choose(i)}><span>{i + 1}</span><span lang="ja">{o.text}</span></button>
        )}</div> : <section className={styles.review} aria-label={t("答えの確認", "답 확인")}>
          <div className={styles.reviewText} aria-live="polite">
            <strong className={styles.reviewLabel}>{q.socket.options[selected].accepted ? t("✓ 正解", "✓ 정답") : t("正解を確認しよう", "정답을 확인해요")}</strong>
            <p lang="ja" className={styles.answerText}>{q.socket.options[selected].accepted ? q.socket.options[selected].text : q.socket.original}</p>
            <p lang="ko" className={styles.translation}>{q.sentence.translation}</p>
          </div>
          <div className={styles.reviewControls}>
            <button className={styles.nextButton} onClick={advance} aria-label={t("次へ", "다음 문제")}>
              <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" /><circle cx="20" cy="20" r="17" className={styles.countdown} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ratio} /></svg><span>→</span>
            </button>
            <button className={styles.iconButton} onClick={() => setPaused(p => !p)} aria-label={paused ? t("自動送りを再開", "자동 진행 재개") : t("自動送りを停止", "자동 진행 정지")} aria-pressed={paused}>{paused ? "▶" : "Ⅱ"}</button>
          </div>
          <small className={styles.reviewHint}>{paused ? t("自動送り停止中 · ▶で再開", "자동 진행 정지 중 · ▶로 재개") : t("自動で次へ · Ⅱで停止", "자동으로 다음 · Ⅱ로 정지")}</small>
        </section>}
        <footer className={styles.footer}><Link href="/">{t("ホームへ", "홈으로")}</Link><span>{paused ? t("一時停止中", "일시정지 중") : answered ? t("Space：停止 / 再開", "Space: 정지 / 재개") : t("タップで回答 · 1–4", "터치로 선택 · 1–4")}</span></footer>
      </> : null}
  </main>;
}
