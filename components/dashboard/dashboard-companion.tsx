import type { ReactNode } from "react";
import type { CompanionSection } from "@/lib/dashboard/companion";
import css from "./dashboard-companion.module.css";

export function CompanionIntro({ title, caption, tag, children }: { section: CompanionSection; title: string; caption: string; tag?: string; children?: ReactNode }) {
  return <div className={css.intro}>
    <div className={css.heading}><h2>{title}</h2>{children}{tag && <span className={css.tag}>{tag}</span>}</div>
    <p className={css.note}>{caption}</p>
  </div>;
}
export function CompanionWelcome({ title, caption }: { title: string; caption: string }) {
  return <div className={css.welcome}><CompanionIntro section="overview" title={title} caption={caption} /></div>;
}
