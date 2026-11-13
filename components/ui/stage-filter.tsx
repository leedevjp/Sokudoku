"use client";
import { useState, useId } from "react";
import { levelDifficulty } from "@/lib/game/selection";
import { Modal } from "./modal";
import styles from "./stage-filter.module.css";
export function StageFilter({ value, onChange, personal = false, disabled = false, t }: {
  value: string; onChange: (value: string) => void; personal?: boolean; disabled?: boolean; t: (jp: string, kr: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const title = useId();
  const options = [
    { value: "all", label: t("全ステージ", "전체 단계"), detail: "" },
    ...(!personal ? [{ value: "H", label: t("ひらがな", "히라가나"), detail: "" }, { value: "K", label: t("カタカナ", "가타카나"), detail: "" }] : []),
    ...Object.entries(levelDifficulty).map(([value, range]) => ({ value, label: t(`ステージ${value}`, `${value}단계`), detail: t(`難易度 ${range[0]}〜${range[1]}`, `난이도 ${range[0]}~${range[1]}`) })),
    personal ? { value: "10", label: t("実践", "실전"), detail: t("難易度 10", "난이도 10") } : { value: "P", label: t("P・個人単語", "P · 개인 단어"), detail: t("自分の単語帳", "내 단어장") },
  ];
  return <>
    <button className={styles.trigger} disabled={disabled} aria-label={t("ステージ", "단계 필터")} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span>{options.find(option => option.value === value)?.label}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <Modal open titleId={title} onClose={() => setOpen(false)}>
      <div className={styles.panel}><h2 id={title}>{t("ステージ", "단계 필터")}</h2>
        <div className={styles.options}>{options.map(option => <button key={option.value} className={styles.option} aria-pressed={value === option.value} onClick={() => { onChange(option.value); setOpen(false); }}>
          <span>{option.label}{option.detail && <small>{option.detail}</small>}</span><span aria-hidden="true">{value === option.value ? "✓" : ""}</span>
        </button>)}</div>
      </div>
    </Modal>}
  </>;
}
