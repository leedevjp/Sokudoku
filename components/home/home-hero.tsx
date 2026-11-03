import { useSettings } from "@/app/settings";

export function HomeHero() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
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
            <strong>兄</strong>
            <span className="preview-reading">あに</span>
          </div>
        </div>
        <div className="preview-answer">
          <span>1</span>
          <b>형(형, 오빠)</b>
          <i>↗</i>
        </div>
      </div>
    </section>
  );
}
