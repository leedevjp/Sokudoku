"use client";

import { useId, useState } from "react";
import { Modal } from "./modal";
import styles from "./stage-filter.module.css";

export type FilterOption<T extends string> = { value: T; label: string; detail?: string };

/** Single-choice filters share a compact trigger and an accessible selection sheet. */
export function FilterSelect<T extends string>({ value, onChange, options, title, disabled = false }: {
  value: T;
  onChange: (value: T) => void;
  options: FilterOption<T>[];
  title: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const selected = options.find(option => option.value === value);
  function close() {
    setOpen(false);
  }
  return <>
    <button type="button" className={styles.trigger} disabled={disabled}
      aria-label={`${title}: ${selected?.label ?? ""}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}>
      <span>{selected?.label}</span>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <Modal open titleId={id} hideClose className={styles.dialog} onClose={close}>
      <h2 className={styles.srOnly} id={id}>{title}</h2>
      <div className={styles.options} role="group" aria-labelledby={id}>
        {options.map(option => <label key={option.value} className={styles.option}>
          <span className={styles.copy}><span>{option.label}</span>{option.detail && <small>{option.detail}</small>}</span>
          <input type="radio" name={id} value={option.value} checked={value === option.value}
            autoFocus={value === option.value} onChange={() => { onChange(option.value); close(); }}
            onClick={() => { if (value === option.value) close(); }} />
          <span className={styles.indicator} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        </label>)}
      </div>
    </Modal>}
  </>;
}
