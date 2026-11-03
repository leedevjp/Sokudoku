import { useEffect, useState } from "react";
import { useSettings } from "@/app/settings";
import { createClient } from "@/lib/supabase/client";
import { choiceLabel } from "@/lib/game/rules";

type PreviewWord = {
  term: string;
  kana: string;
  hanja_reading: string | null;
  meaning_ko: string;
};
const terms = ["兄", "姉", "弟", "妹"];
// Initial/offline display mirrors the existing DB entries; authenticated visits refresh these four rows.
const initialWords: PreviewWord[] = [
  { term: "兄", kana: "あに", hanja_reading: "형", meaning_ko: "형, 오빠" },
  { term: "姉", kana: "あね", hanja_reading: "자", meaning_ko: "누나, 언니" },
  { term: "弟", kana: "おとうと", hanja_reading: "제", meaning_ko: "남동생" },
  { term: "妹", kana: "いもうと", hanja_reading: "매", meaning_ko: "여동생" },
];

export function HomeHero({ authenticated }: { authenticated: boolean }) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const [words, setWords] = useState(initialWords);
  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void createClient()
      .from("word")
      .select("term,kana,hanja_reading,meaning_ko")
      .eq("entry_type", "word")
      .is("deleted_at", null)
      .in("term", terms)
      .limit(4)
      .abortSignal(controller.signal)
      .then(
        ({ data }) => {
          if (controller.signal.aborted || !data) return;
          setWords(
            initialWords.map(
              (fallback) =>
                data.find((word) => word.term === fallback.term) ?? fallback,
            ),
          );
        },
        () => {},
      );
    return () => controller.abort();
  }, [authenticated]);
  const target = words[0];
  return (
    <section className="home-content">
      <div className="preview-stack home-visual" aria-hidden="true">
        <span className="spark s1">✦</span>
        <span className="spark s2">✦</span>
        <div className="preview-target">
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div className="preview-word">
            <span className="preview-kind">
              <i />
              {t("意味", "의미")}
            </span>
            <strong>{target.term}</strong>
            <span className="preview-reading">{target.kana}</span>
          </div>
        </div>
        <div className="home-answer-list">
          {words.map((word, index) => (
            <div className="preview-answer" key={word.term}>
              <span>{index + 1}</span>
              <b>{choiceLabel(word, "meaning")}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
