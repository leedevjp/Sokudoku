"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import { TreasureReveal, tierName, type Tier } from "./treasure-reveal";
import styles from "./treasure.module.css";
type Inventory = { progress: number; pending_count: number; pending: { id: string; ordinal: number }[]; collection: Record<Tier, number> };
export function TreasureVault() {
 const { prefs } = useSettings(); const jp = prefs.lang === "jp";
 const [data, setData] = useState<Inventory | null>(null);
 const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
 const [result, setResult] = useState<{ id: string; tier: Tier } | null>(null);
 const lock = useRef(false);
 const refresh = useCallback(async (signal?: AbortSignal) => {
  const response = await fetch("/api/treasure", { cache: "no-store", signal: signal ?? AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("load");
  setData(await response.json()); setError(false);
 }, []);
 useEffect(() => {
  const controller = new AbortController();
  void fetch("/api/treasure", { cache: "no-store", signal: controller.signal }).then(async response => {
   if (!response.ok) throw Error("load");
   const inventory: Inventory = await response.json();
   if (!controller.signal.aborted) { setData(inventory); setError(false); }
  }).catch(() => { if (!controller.signal.aborted) setError(true); });
  return () => controller.abort();
 }, []);
 async function open() {
  const id = data?.pending[0]?.id; if (!id || lock.current || result) return;
  lock.current = true; setBusy(true); setError(false);
  try {
   const response = await fetch("/api/treasure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(15000) });
   if (!response.ok) { if (response.status === 409 || response.status === 404) await refresh(); throw Error("open"); }
   setResult(await response.json()); await refresh();
  } catch { setError(true); } finally { lock.current = false; setBusy(false); }
 }
 return <section className={styles.vault} aria-labelledby="treasure-title" aria-busy={busy}>
  <div className={styles.heading}><h2 id="treasure-title">{jp ? "学習の宝箱" : "학습 보물상자"}</h2><span>{data ? `${data.pending_count}${jp ? "個待機" : "개 보관 중"}` : "…"}</span></div>
  <p>{jp ? "5問回答するたびに1個。正解・不正解を含み、時間切れは対象外です。" : "5문제에 답할 때마다 1개. 정답·오답 포함, 시간 초과 제외."}</p>
  {data && <>
   <div className={styles.progress} role="progressbar" aria-label={jp ? "次の宝箱まで" : "다음 상자까지"} aria-valuenow={data.progress} aria-valuemin={0} aria-valuemax={5}><span style={{ width: `${data.progress * 20}%` }} /></div>
   <p className={styles.small}>{jp ? "次の宝箱" : "다음 상자"} {data.progress}/5 · {jp ? "サーバー保存後に反映" : "서버 저장 후 반영"}</p>
   <div className={styles.boxes}>
    {data.pending.map((box, index) => <button key={box.id} onClick={() => void open()} disabled={busy || !!result || index !== 0} className={styles.box} aria-label={index === 0 ? jp ? "次の宝箱を開ける" : "다음 상자 열기" : jp ? "順番待ちの宝箱" : "순서를 기다리는 상자"}>
     <span className={styles.silhouette} aria-hidden="true" /><b aria-hidden="true">?</b><small>{index === 0 ? jp ? "タッチ" : "터치" : jp ? "待機" : "대기"}</small>
    </button>)}
   </div>
   {!data.pending_count && <p className={styles.empty}>{jp ? "学習して宝箱を集めよう。" : "문제를 풀고 첫 상자를 모아보세요."}</p>}
   {!!data.pending_count && <p className={styles.small}>{jp ? "古い順に1個ずつ開けます。" : "오래된 순서로 하나씩 열어요."}{data.pending_count > 12 && (jp ? "残りは開封後に表示されます。" : "나머지 상자는 개봉 후 이어서 표시돼요.")}</p>}
   <div className={styles.collection}>{(["common", "rare", "unique"] as const).map(tier => <span key={tier}>{tierName(tier, jp)} <b>{data.collection[tier]}</b></span>)}</div>
  </>}
  <p className={styles.small}>{jp ? "出現率：コモン60%・レア30%・ユニーク10%" : "등장 확률: 커먼 60% · 레어 30% · 유니크 10%"}</p>
  {error && <div role="alert"><p>{jp ? "確認できませんでした。再試行してください。" : "처리 결과를 확인하지 못했어요. 다시 시도해주세요."}</p><button className={styles.action} disabled={busy} onClick={() => data?.pending[0] ? void open() : void refresh().catch(() => setError(true))}>{jp ? "再試行" : "다시 시도"}</button></div>}
  {result && <TreasureReveal key={result.id} tier={result.tier} jp={jp} onClose={() => setResult(null)} />}
 </section>;
}
