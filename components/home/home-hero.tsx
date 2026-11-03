import { useSettings } from "@/app/settings";

export function HomeHero() {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  return (
    <section className="home-content">
      <p className="eyebrow">
        {t("ひと目でわかる。その先へ。", "보는 순간 이해하는, 그 다음으로.")}
      </p>
      <h1>
        {t("知っている言葉を、", "아는 단어를,")}
        <br />
        <span>{t("瞬間のチカラに。", "순간의 실력으로.")}</span>
      </h1>
      <p className="description">
        {t(
          "意味をつかむ。読みがひらめく。",
          "뜻을 떠올리고, 읽기가 번뜩이는 순간.",
        )}
        <br />
        {t(
          "小さな反復で、日本語がもっと軽やかに。",
          "작은 반복으로 일본어를 더 가볍게.",
        )}
      </p>
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
