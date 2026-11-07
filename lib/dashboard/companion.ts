import type { DashboardSummary } from "./summary";
import { companionLines, type CompanionLine } from "./companion-lines";

export type CompanionSection = "overview" | "memory" | "activity" | "stages";
export type CompanionFocus = { section: CompanionSection; day?: string; level?: string; band?: number };

export function companionFocusKey(focus: CompanionFocus) {
  return [focus.section, focus.day ?? "", focus.level ?? "", focus.band ?? ""].join(":");
}

/** Encouragement is grounded in the selected scope; never a claim of mastery. */
function recordMessage(summary: DashboardSummary, focus: CompanionFocus, lang: string) {
  const jp = lang === "jp", n = (value: number) => value.toLocaleString(jp ? "ja-JP" : "ko-KR");
  const say = (ja: string, ko: string) => jp ? ja : ko;
  if (focus.section === "overview") {
    if (!summary.learned) return say("最初のひとつから、一緒に始めよう。", "첫 번째 하나부터, 같이 시작해볼까?");
    const today = summary.days[6].attempts;
    return today > 0
      ? say(`今日は${n(today)}問。ひとつずつ、一緒に進んでるね！`, `오늘 ${n(today)}문제! 하나씩 같이 나아가고 있네.`)
      : say(`もう${n(summary.learned)}個と出会ったね。今日も自分のペースで。`, `벌써 ${n(summary.learned)}개를 만났네. 오늘도 네 속도로 가자.`);
  }
  if (focus.section === "memory") {
    if (focus.band !== undefined && focus.band >= 0 && focus.band <= 2) {
      const count = summary.memory[focus.band];
      return count ? say(`このグループには${n(count)}個。何度会っても大丈夫だよ。`, `이 구간에는 ${n(count)}개가 있어. 여러 번 다시 만나도 괜찮아.`)
        : say("このグループはまだ空っぽ。少しずつ育てていこう。", "이 구간은 아직 비어 있어. 천천히 채워가자.");
    }
    const familiar = summary.memory[1] + summary.memory[2];
    return familiar ? say(`${n(familiar)}個が少しずつなじんできたね。ときどき会いに行こう。`, `${n(familiar)}개가 조금씩 익숙해지고 있어. 가끔 다시 만나러 가자.`)
      : say("覚える速さはそれぞれ。繰り返すたびに、また一歩。", "익숙해지는 속도는 달라도 괜찮아. 다시 만날 때마다 한 걸음!");
  }
  if (focus.section === "activity") {
    const day = summary.days.find(d => d.day === focus.day);
    if (day) return day.attempts
      ? say(`この日は${n(day.attempts)}問！取り組んだひとつひとつが大切だね。`, `이날은 ${n(day.attempts)}문제를 풀었네! 하나하나 소중한 기록이야.`)
      : say("お休みの日もあって大丈夫。また会えたらうれしいな。", "쉬어간 날이 있어도 괜찮아. 다시 만나면 반가우니까.");
    const active = summary.days.filter(d => d.attempts > 0).length;
    return active ? say(`この7日間で${active}日も会えたね。来てくれてありがとう！`, `최근 7일 동안 ${active}일이나 만났네. 와줘서 고마워!`)
      : say("おかえり。またひとつ、一緒にやってみよう。", "다시 와줘서 반가워. 또 하나씩 같이 해보자.");
  }
  const rows = focus.level ? summary.groups.filter(g => focus.level === "kana" ? g.level !== "P" : g.level === focus.level) : [];
  if (rows.length) {
    const count = rows.reduce((sum, row) => sum + row.learned, 0);
    const name = focus.level === "P" ? say("自分の単語", "내 단어") : focus.level === "kana" ? say("かな", "가나") : say(`${focus.level}段階`, `${focus.level}단계`);
    return count ? say(`${name}では${n(count)}個と出会ったね。次のひとつも一緒に。`, `${name}에서 ${n(count)}개를 만났네. 다음 하나도 같이 가자.`)
      : say(`${name}はこれから。一度に全部じゃなくて大丈夫。`, `${name}는 이제 시작이야. 한꺼번에 다 하지 않아도 괜찮아.`);
  }
  return say("ひらいてみて。次に会いたい単語を一緒に探そう。", "단계를 펼쳐봐. 다음에 만날 단어를 같이 찾아보자.");
}

/** A full cycle is exhausted before repeating; extra lines match the current context. */
export function companionMessage(summary: DashboardSummary, focus: CompanionFocus, lang: string, variant = 0) {
  let specific: readonly CompanionLine[] = [];
  if (focus.section === "overview" && summary.learned === 0) specific = companionLines.first;
  if (focus.section === "memory" && focus.band !== undefined && summary.memory[focus.band] > 0) {
    specific = [companionLines.band0, companionLines.band1, companionLines.band2][focus.band] ?? [];
  }
  if (focus.section === "activity") {
    const day = summary.days.find(d => d.day === focus.day);
    if (day ? day.attempts === 0 : summary.week.attempts === 0) specific = companionLines.rest;
  }
  if (focus.section === "stages" && focus.level === "P") specific = companionLines.personal;
  const lines = [recordMessage(summary, focus, lang), ...[...specific, ...companionLines[focus.section]].map(line => line[lang === "jp" ? 0 : 1])];
  return lines[((variant % lines.length) + lines.length) % lines.length];
}

export function visibleCompanionSection(rects: { section: CompanionSection; top: number; bottom: number }[], height: number): CompanionSection | null {
  const visible = rects.filter(r => Math.min(r.bottom, height - 16) - Math.max(r.top, 16) >= 64);
  visible.sort((a, b) => {
    const score = (r: typeof a) => Math.abs((Math.max(r.top, 16) + Math.min(r.bottom, height - 16)) / 2 - height * 0.4);
    return score(a) - score(b);
  });
  return visible[0]?.section ?? null;
}
