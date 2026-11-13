"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import styles from "./treasure.module.css";
export type Tier = "common" | "rare" | "unique";
export const tierName = (tier: Tier, jp: boolean) => ({ common: jp ? "コモン" : "커먼", rare: jp ? "レア" : "레어", unique: jp ? "ユニーク" : "유니크" })[tier];
type Frame = { x: number; y: number; w: number; h: number; draw?: { x: number; y: number; w: number; h: number } };
async function atlas(name: string, signal: AbortSignal) {
 const response = await fetch(`/treasure/${name}.json`, { signal });
 if (!response.ok) throw Error("asset");
 const data: { image: string; frames: Frame[] } = await response.json();
 const image = new Image(); image.src = `/treasure/${data.image}`; await image.decode();
 return { ...data, image };
}
export function TreasureReveal({ tier, jp, onClose }: { tier: Tier; jp: boolean; onClose: () => void }) {
 const canvas = useRef<HTMLCanvasElement>(null);
 const [done, setDone] = useState(false);
 const [failed, setFailed] = useState(false);
 useEffect(() => {
  const controller = new AbortController(); let active = true; let expired = false; let timer: ReturnType<typeof setTimeout>;
  const deadline = setTimeout(() => { if (active) { expired = true; controller.abort(); setFailed(true); setDone(true); } }, 15000);
  Promise.all([atlas("chests-pixel-v1", controller.signal), atlas("mage-opening-v2", controller.signal)]).then(([chest, mage]) => {
   clearTimeout(deadline);
   if (!active || expired) return;
   const ctx = canvas.current?.getContext("2d"); if (!ctx) { setDone(true); return; }
   const draw = (a: typeof chest, index: number, x: number, y: number, size: number) => {
    const f = a.frames[index]; ctx.imageSmoothingEnabled = false;
    if (f.draw) ctx.drawImage(a.image, f.x, f.y, f.w, f.h, x + f.draw.x, y + f.draw.y, f.draw.w, f.draw.h);
    else ctx.drawImage(a.image, f.x, f.y, f.w, f.h, x, y, size, size);
   };
   let step = matchMedia("(prefers-reduced-motion: reduce)").matches ? 7 : 0;
   const paint = () => {
    if (!active) return;
    ctx.clearRect(0, 0, 256, 128);
    draw(chest, ["common", "rare", "unique"].indexOf(tier) * 8 + [0, 0, 0, 2, 3, 4, 5, 7][step], 50, 32, 96);
    draw(mage, step, 80, 4, 128);
    if (step < 7) { step++; timer = setTimeout(paint, 200); } else setDone(true);
   }; paint();
  }).catch(() => { if (active) { setFailed(true); setDone(true); } });
  return () => { active = false; controller.abort(); clearTimeout(timer); clearTimeout(deadline); };
 }, [tier]);
 return <Modal open titleId="treasure-reveal-title" dismissDisabled={!done} onClose={onClose}>
  <div className={styles.reveal}>
   <h2 id="treasure-reveal-title" aria-live="polite">{done ? `${tierName(tier, jp)} ${jp ? "獲得！" : "획득!"}` : jp ? "開けています…" : "상자를 여는 중…"}</h2>
   <canvas ref={canvas} width={256} height={128} className={styles.scene} aria-label={jp ? "宝箱を開ける魔法使い" : "상자를 여는 마법사"} role="img" />
   {failed && <p>{jp ? "演出を読み込めませんでした。獲得結果は保存されています。" : "연출을 불러오지 못했지만 획득 결과는 저장됐어요."}</p>}
   <button disabled={!done} onClick={onClose} className={styles.action}>{jp ? "確認" : "확인"}</button>
  </div>
 </Modal>;
}
