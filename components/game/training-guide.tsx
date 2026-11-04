import type { Lang } from "@/lib/game/preferences";
import {
  INITIAL_HEARTS,
  limitFor,
  MISTAKE_FEEDBACK_MS,
} from "@/lib/game/rules";

/** Non-blocking instructions shown only while the game actually loads. */
export function TrainingGuide({ lang }: { lang: Lang }) {
  const t = (jp: string, kr: string) => (lang === "jp" ? jp : kr);
  return (
    <section className="training-guide" aria-labelledby="training-guide-title">
      <h2 id="training-guide-title">{t("遊び方", "플레이 방법")}</h2>
      <ul>
        <li>
          <b>{t("4択で答える", "4개 중 하나를 선택해요")}</b>
          <p>
            {t(
              "数字キー・テンキーの1〜4、タッチ、クリックに対応。押した瞬間に回答します。",
              "숫자키·키패드 1~4, 터치와 클릭을 지원해요. 누르는 순간 답변이 확정돼요.",
            )}
          </p>
        </li>
        <li>
          <b>{INITIAL_HEARTS} ♥</b>
          <p>
            {t(
              "誤答・時間切れでライフ−1。",
              "오답·시간 초과 시 하트가 하나 줄어요.",
            )}{" "}
            {MISTAKE_FEEDBACK_MS / 1000}
            {t(
              "秒後に次へ。正解カード・正解番号ですぐに進めます。Space・Ⅱで停止／再開。",
              "초 후 다음으로 넘어가요. 정답 카드·정답 번호로 바로 진행하고, Space·Ⅱ로 정지·재개해요.",
            )}
          </p>
        </li>
        <li>
          <b>
            {limitFor(0) / 1000} → {limitFor(100) / 1000}s
          </b>
          <p>
            {t(
              "正答ごとに制限時間が0.2秒短くなります。",
              "정답마다 제한 시간이 0.2초씩 줄어들어요.",
            )}
          </p>
        </li>
      </ul>
      <p className="training-guide-note">
        {t(
          "探索は未学習の単語から均等に、復習は記憶状態に合わせて出題します。",
          "탐색은 아직 만나지 않은 단어에서 균등하게, 복습은 기억 상태에 맞춰 출제해요.",
        )}
      </p>
    </section>
  );
}
