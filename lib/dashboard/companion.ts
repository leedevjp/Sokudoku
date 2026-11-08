import type { DashboardSummary } from "./summary";
import { companionLines, type CompanionLine } from "./companion-lines";

export type CompanionSection = "overview" | "memory" | "activity" | "stages";
export type CompanionFocus = { section: CompanionSection; day?: string; level?: string; band?: number; topic?: string };

export function companionFocusKey(focus: CompanionFocus) {
  return [focus.section, focus.day ?? "", focus.level ?? "", focus.band ?? "", focus.topic ?? ""].join(":");
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

const topicLines: Record<string, readonly CompanionLine[]> = {
  learned: [["ここは一度でも答えた項目の数だよ。", "여긴 한 번이라도 답한 항목 수야."],["少しずつ増えていく足跡だね。","조금씩 늘어나는 발자국이네."]],
  total: [["まだ出会っていない言葉も含めた全体の数だよ。","아직 만나지 않은 단어까지 포함한 전체 수야."]],
  common: [["みんなで使う共通の単語たちだよ。","모두가 사용하는 공통 단어들이야."]],
  personal: [["自分で集めた言葉も、ここに入ってるよ。","직접 모은 단어도 여기에 있어."]],
  review: [["今、復習の候補になっている項目だよ。","지금 복습 후보로 잡힌 항목이야."],["忘れかけた言葉に会いに行こうか。","잊혀가는 단어들을 만나러 갈까?"]],
  attempts: [["正解も間違いも、時間切れも数えているよ。","정답도 오답도 시간 초과도 세고 있어."]],
  memoryHelp: [["この三段階は記憶の安定度の目安なんだ。","이 세 단계는 기억 안정성의 기준이야."],["ずっと覚えている保証ではないんだよ。","영원히 기억한다는 보장은 아니야."]],
  memoryTotal: [["三つのグループを合わせた数だよ。","세 그룹을 모두 합친 숫자야."]],
  weekTotal: [["この七日間に答えた回数と学習した日数だよ。","최근 7일 답변 횟수와 학습한 날짜 수야."]],
  dayDetail: [["選んだ日の回答数がここに出るよ。","선택한 날의 답변 수가 여기 나와."]],
  accuracy: [["正答数を全回答数で割った割合だよ。","전체 답변 중 정답의 비율이야."],["時間切れも回答数に含まれるよ。","시간 초과도 답변 수에 포함돼."]],
  responseTime: [["正解したときの平均回答時間だよ。","정답을 맞혔을 때의 평균 응답 시간이야."],["速さは参考記録。記憶の段階には影響しないよ。","속도는 참고 기록이고 기억 단계에는 영향을 주지 않아."]],
  activityNote: [["速さと記憶の安定度は別々に見ているよ。","응답 속도와 기억 안정성은 따로 보고 있어."]],
  stageProgress: [["この段階で出会った数と全体の数だよ。","이 단계에서 학습한 수와 전체 수야."]],
  stageUnlearned: [["まだ出会っていない項目がここにあるよ。","아직 만나지 않은 항목들이 여기 있어."]],
  stage0: [["ここは覚え始めた言葉の数だよ。","여긴 처음 학습 중인 단어 수야."]],
  stage1: [["少しずつなじんでいる言葉だね。","조금씩 익숙해지는 단어들이네."]],
  stage2: [["長く覚えていられると推定された言葉だよ。","오래 기억할 것으로 추정되는 단어들이야."]],
  stageNote: [["自分で追加した言葉は別に集計するよ。","직접 추가한 단어는 따로 집계해."]],
};

/** A full cycle is exhausted before repeating; extra lines match the current context. */
export function companionMessage(summary: DashboardSummary, focus: CompanionFocus, lang: string, variant = 0, hour?: number) {
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
  const timeKey = hour === undefined ? null : hour < 5 ? "night" : hour < 11 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "night";
  if (focus.topic && topicLines[focus.topic]) specific = topicLines[focus.topic];
  const extra = [...specific, ...companionLines[focus.section], ...(focus.section === "overview" && timeKey ? companionLines[timeKey] : [])];
  const lines = focus.topic && topicLines[focus.topic]
    ? extra.map(line => line[lang === "jp" ? 0 : 1])
    : [recordMessage(summary, focus, lang), ...extra.map(line => line[lang === "jp" ? 0 : 1])];
  return lines[((variant % lines.length) + lines.length) % lines.length];
}

export function visibleCompanionSection(rects: { section: CompanionSection; top: number; bottom: number }[], height: number): CompanionSection | null {
  const visible = rects.filter(r => Math.min(r.bottom, height - 16) - Math.max(r.top, 16) >= 64);
  visible.sort((a, b) => {
    const score = (r: typeof a) => Math.max(r.top - height / 2, height / 2 - r.bottom, 0);
    return score(a) - score(b);
  });
  return visible[0]?.section ?? null;
}
