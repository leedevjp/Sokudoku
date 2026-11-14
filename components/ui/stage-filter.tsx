"use client";
import { levelDifficulty } from "@/lib/game/selection";
import { FilterSelect } from "./filter-select";
export function StageFilter({ value, onChange, personal = false, disabled = false, t }: {
  value: string; onChange: (value: string) => void; personal?: boolean; disabled?: boolean; t: (jp: string, kr: string) => string;
}) {
  const options = [
    { value: "all", label: t("全ステージ", "전체 단계"), detail: "" },
    ...(!personal ? [{ value: "H", label: t("ひらがな", "히라가나"), detail: "" }, { value: "K", label: t("カタカナ", "가타카나"), detail: "" }] : []),
    ...Object.entries(levelDifficulty).map(([value, range]) => ({ value, label: t(`ステージ${value}`, `${value}단계`), detail: t(`難易度 ${range[0]}〜${range[1]}`, `난이도 ${range[0]}~${range[1]}`) })),
    personal ? { value: "10", label: t("実践", "실전"), detail: t("難易度 10", "난이도 10") } : { value: "P", label: t("P・個人単語", "P · 개인 단어"), detail: t("自分の単語帳", "내 단어장") },
  ];
  return <FilterSelect value={value} onChange={onChange} options={options} disabled={disabled}
    title={t("学習ステージ", "학습 단계")} />;
}
