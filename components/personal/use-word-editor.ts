"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { personalWordInput } from "@/lib/personal/schema";
import type { PersonalWord } from "@/lib/personal/types";

export function useWordEditor(
  word: PersonalWord | null,
  onClose: () => void,
  onSaved: (created: boolean) => void,
) {
  const [form, setForm] = useState(() => ({
    term: word?.term ?? "",
    kana: word?.kana ?? "",
    meaning_ko: word?.meaning_ko ?? "",
    hanja_reading: word?.hanja_reading ?? "",
    difficulty: word?.difficulty ?? 6,
    note: word?.note ?? "",
  }));
  const [baseline] = useState(() => JSON.stringify(form));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const dirty = JSON.stringify(form) !== baseline;
  useEffect(() => {
    if (!dirty || busy) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, busy]);
  function close() {
    if (lock.current) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function field(name: keyof typeof form, value: string | number) {
    setForm((old) => ({ ...old, [name]: value }));
    setFields((old) => old.filter((f) => f !== name));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = personalWordInput.safeParse(form);
    if (!parsed.success) {
      setFields([
        ...new Set(parsed.error.issues.map((i) => String(i.path[0]))),
      ]);
      setError("invalid_input");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/personal" + (word ? "/" + word.id : ""),
        {
          method: word ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            ...parsed.data,
            ...(word ? { updated_at: word.updated_at } : {}),
          }),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "save_failed");
        setFields(Object.keys(result.fields ?? {}));
        return;
      }
      onSaved(!word);
    } catch {
      setError("save_failed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { form, busy, discard, setDiscard, error, fields, close, field, save };
}
