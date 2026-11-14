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
    if (!summary.attempts) return say("最初のひとつから、一緒に始めよう。", "첫 번째 하나부터, 같이 시작해볼까?");
    const today = summary.days[6].attempts;
    return today > 0
      ? say(`今日は${n(today)}問。ひとつずつ、一緒に進んでるね！`, `오늘 ${n(today)}문제! 하나씩 같이 나아가고 있네.`)
      : say(`もう${n(summary.attempts)}回答えたんだね。今日も自分のペースで。`, `벌써 ${n(summary.attempts)}번 답했네. 오늘도 네 속도로 가자.`);
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

/** Speak to the learner's progress rather than reading labels or help text aloud. */
function progressLines(summary: DashboardSummary, focus: CompanionFocus): readonly CompanionLine[] {
  const fmt = (value: number) => value.toLocaleString("en-US");
  const learned = summary.learned;
  const memory = summary.memory;
  const week = summary.week;
  const days = summary.days.filter(d => d.attempts > 0).length;
  const groups = focus.level ? summary.groups.filter(g => focus.level === "kana" ? g.level !== "P" : g.level === focus.level) : [];
  const groupLearned = groups.reduce((sum, g) => sum + g.learned, 0);
  const groupMemory = (i: number) => groups.reduce((sum, g) => sum + g.memory[i], 0);
  const groupName = focus.level === "P" ? ["自分の単語", "내 단어"] : focus.level === "kana" ? ["かな", "가나"] : [`${focus.level ?? ""}段階`, `${focus.level ?? ""}단계`];
  const positive = (value: number, ja: string, ko: string, emptyJa: string, emptyKo: string): CompanionLine[] =>
    value > 0 ? [[ja, ko]] : [[emptyJa, emptyKo]];
  const zero: CompanionLine[] = [
    ["ここはまだこれからだね。一緒に少しずつ育てよう。", "여긴 아직 시작 전이네. 하나씩 채워가자."],
    ["空っぽの場所には、これからの楽しみが詰まってるよ。", "비어 있는 곳에는 앞으로의 가능성이 가득하지."],
    ["焦らなくていいよ。最初の一歩を待ってるね。", "서두르지 않아도 돼. 첫걸음을 기다릴게."],
  ];
  const topic = focus.topic;
  if (topic === "learned" || topic === "total" || topic === "common") {
    const count = topic === "common" ? summary.common.learned : topic === "total" ? summary.total : learned;
    if (count === 0) return zero;
    if (topic === "total") return [
      [`全部で${fmt(count)}個の言葉が待ってるよ。楽しみがいっぱい！`, `전체 ${fmt(count)}개 단어가 기다리고 있어. 만날 친구가 정말 많네!`],
      [`そのうち${fmt(learned)}個ともう出会ったんだね。`, `그중 ${fmt(learned)}개나 이미 만나봤구나!`],
    ];
    return [
      ...positive(count, `もう${fmt(count)}個も学んだんだね！すごい！`, `벌써 ${fmt(count)}개나 공부했네! 굉장해!`, "最初のひとつ、楽しみにしてるよ。", "첫 단어부터 같이 시작해보자!"),
      [`${fmt(count)}個との出会い、ひとつひとつ積み重ねたんだね。`, `${fmt(count)}개를 만날 때까지 하나씩 쌓아왔구나.`],
      ["ここまで来た自分を、ちょっと褒めてあげてね。", "여기까지 온 자신을 조금 칭찬해줘도 좋아."],
    ];
  }
  if (topic === "personal" && summary.personal.learned === 0) return zero;
  if (topic === "personal") return [
    [`自分で集めた言葉が${fmt(summary.personal.learned)}個！宝物が増えてるね。`, `직접 모은 단어가 ${fmt(summary.personal.learned)}개! 보물상자가 커지고 있네.`],
    ["君だけの単語帳、どんな言葉でいっぱいになるかな。", "너만의 단어장이 어떤 말들로 채워질지 궁금해."],
  ];
  if (topic === "review" && summary.review === 0) return [["復習待ちは今はゼロ！また新しい言葉に会いに行こう。", "지금 복습 대기 중인 단어는 없네! 새로운 단어를 만나러 가볼까?"], ...zero];
  if (topic === "review") return [
    [`また会いたい言葉が${fmt(summary.review)}個。私も一緒に行くよ！`, `다시 만나볼 단어가 ${fmt(summary.review)}개네. 나도 같이 갈게!`],
    ["忘れても、戻ってきてくれるのがうれしいな。", "잊어도 다시 만나러 와주는 게 기뻐."],
  ];
  if (topic === "attempts" && summary.attempts === 0) return zero;
  if (topic === "attempts") return [
    [`もう${fmt(summary.attempts)}回も答えたんだね！すごい！`, `벌써 ${fmt(summary.attempts)}번이나 답했네! 굉장해!`],
    ["間違えた日も含めて、全部君が進んだ足跡だよ。", "틀린 날까지 전부 네가 걸어온 발자국이야."],
  ];
  if (topic === "memoryHelp" || topic === "activityNote" || topic === "stageNote") return [
    ["数字だけじゃなくて、ここまで続けた君も見ていたいな。", "숫자도 좋지만, 여기까지 이어온 너를 더 보고 싶어."],
    ["今日はどの記録がいちばんうれしい？", "오늘은 어떤 기록이 가장 마음에 들어?"],
  ];
  if (topic === "memoryTotal" && learned === 0) return zero;
  if (topic === "memoryTotal") return [
    [`${fmt(learned)}個もの言葉が君の記録に並んでる！`, `${fmt(learned)}개의 단어가 네 기록에 나란히 있네!`],
    ["少しずつ積み上げてきたんだね。えらいなあ。", "조금씩 쌓아온 거구나. 정말 수고했어."],
  ];
  if (topic === "weekTotal" && week.attempts === 0) return zero;
  if (topic === "weekTotal") return [
    [`7日間で${fmt(week.attempts)}問！よく頑張ったね。`, `7일 동안 ${fmt(week.attempts)}문제! 정말 열심히 했네.`],
    [`${days}日も机に向かったんだね。私も見習わなきゃ！`, `${days}일이나 공부하러 왔네. 나도 본받아야겠어!`],
  ];
  if (focus.section === "activity" && focus.day) {
    const day = summary.days.find(day => day.day === focus.day);
    if (!day) return zero; // Unknown dates must not borrow today's or the week's totals.
    return day.attempts > 0 ? [
      [`この日は${fmt(day.attempts)}問！ひとつひとつ、大切な記録だね。`, `이날은 ${fmt(day.attempts)}문제를 풀었네! 하나하나 소중한 기록이야.`],
      ["その日に積み重ねた一問一問、ちゃんと残ってるよ。", "그날 하나씩 풀었던 문제들이 전부 남아 있네."],
    ] : [["お休みの日もあって大丈夫。また会えたらうれしいな。", "쉬어간 날이 있어도 괜찮아. 다시 만나면 반가우니까."]];
  }
  if (topic === "dayDetail") return []; // A day-specific claim requires an actual selected date.
  if (topic === "accuracy") {
    const accuracy = week.attempts ? Math.round(week.correct / week.attempts * 100) : null;
    return accuracy === null ? [["まだこれからだね。一緒に始めよう！", "아직 시작 전이네. 같이 해보자!"]] : [
      [`正解率${accuracy}%！積み重ねが見えてきたね。`, `정답률 ${accuracy}%! 쌓아온 노력이 보이네.`],
      ["間違えた問題も、次の正解につながるよ。", "틀린 문제도 다음 정답으로 이어질 거야."],
    ];
  }
  if (topic === "responseTime") return week.correct ? [
    [`正解まで平均${(week.correct_ms / week.correct / 1000).toFixed(1)}秒！言葉が少しずつ身近になってるね。`, `정답까지 평균 ${(week.correct_ms / week.correct / 1000).toFixed(1)}초! 단어가 점점 친숙해지고 있네.`],
    ["速さもいいけど、覚えていく過程も大事にしよう。", "속도도 좋지만 익혀가는 과정도 소중해."],
  ] : [["これからどんな記録ができるか楽しみだね。", "앞으로 어떤 기록이 생길지 기대돼."]];
  if ((topic === "stageProgress" || topic === "stageUnlearned") && groupLearned === 0) return zero;
  if (topic === "stageProgress" || topic === "stageUnlearned") return [
    [`${groupName[0]}で${fmt(groupLearned)}個も学んだんだ！`, `${groupName[1]}에서 ${fmt(groupLearned)}개나 배웠네!`],
    ["次の言葉にも、きっと出会えるよ。", "다음 단어도 분명 만나게 될 거야."],
  ];
  if (topic === "stage0" || topic === "stage1" || topic === "stage2") {
    const i = Number(topic.slice(-1));
    const count = groupMemory(i);
    if (count === 0) return zero;
    return i === 2 ? [
      [`長く覚えている言葉が${fmt(count)}個！頼もしいね。`, `오래 기억하는 단어가 ${fmt(count)}개! 든든한데?`],
      ["しっかり育ってきた記憶、大事にしよう。", "차곡차곡 자란 기억을 소중히 하자."],
    ] : i === 1 ? [
      [`${fmt(count)}個がだんだんなじんできたね！`, `${fmt(count)}개가 점점 익숙해지고 있네!`],
      ["あと少しで、もっと仲良くなれそう。", "조금만 더 만나면 더 친해질 것 같아."],
    ] : [
      [`新しい出会いが${fmt(count)}個もあるね。`, `새로 만난 단어가 ${fmt(count)}개나 있네.`],
      ["最初はみんな初対面。ゆっくり仲良くなろう。", "처음엔 모두 낯선 사이야. 천천히 친해지자."],
    ];
  }
  if (focus.section === "memory" && focus.band !== undefined) {
    const count = memory[focus.band] ?? 0;
    if (count === 0) return zero;
    if (focus.band === 2) return [
      [`${fmt(count)}個も長く覚えているんだね！すごい！`, `${fmt(count)}개나 오래 기억하고 있네! 대단해!`],
      ["何度も会った言葉たちが、心強い仲間になったね。", "여러 번 만난 단어들이 든든한 친구가 됐네."],
    ];
    if (focus.band === 1) return [
      [`${fmt(count)}個がなじんできたね。いい感じ！`, `${fmt(count)}개가 익숙해지고 있네. 좋은데!`],
      ["また会うたびに、きっと思い出しやすくなるよ。", "다시 만날수록 더 쉽게 떠오를 거야."],
    ];
    return [
      [`${fmt(count)}個の言葉と仲良くなっている途中だね。`, `${fmt(count)}개 단어와 친해지는 중이네.`],
      ["ここからが楽しみだね。私も応援してる！", "이제부터가 기대돼. 나도 응원할게!"],
    ];
  }
  if (focus.section === "overview" && summary.attempts > 0) return [
    [`もう${fmt(summary.attempts)}回も答えたんだね！すごい！`, `벌써 ${fmt(summary.attempts)}번이나 답했네! 굉장해!`],
    [`${fmt(summary.attempts)}回も挑戦してきたんだね。ちゃんと見てるよ。`, `${fmt(summary.attempts)}번이나 도전했구나. 나 다 보고 있었어.`],
    ["昨日の自分には見えなかった言葉が、今日は読めるかもね。", "어제는 낯설던 단어가 오늘은 읽힐지도 모르지."],
  ];
  if (focus.section === "memory" && learned > 0) return [
    [`${fmt(memory[1] + memory[2])}個の言葉が少しずつなじんでるね。`, `${fmt(memory[1] + memory[2])}개 단어가 점점 익숙해지고 있네.`],
    ["何度も会って、少しずつ仲良くなっていこう。", "여러 번 만나면서 천천히 친해지자."],
  ];
  if (focus.section === "activity" && week.attempts > 0) return [
    [`この7日間で${fmt(week.attempts)}問！頑張ったね。`, `최근 7일 동안 ${fmt(week.attempts)}문제! 수고했어.`],
    [`${days}日も勉強したんだ。続けてきたんだね。`, `${days}일이나 공부했네. 꾸준히 해왔구나.`],
  ];
  return [];
}

/** A full cycle is exhausted before repeating; extra lines match the current context. */
export function companionMessage(summary: DashboardSummary, focus: CompanionFocus, lang: string, variant = 0, hour?: number) {
  let specific: readonly CompanionLine[] = [];
  if (focus.section === "overview" && summary.attempts === 0) specific = companionLines.first;
  if (focus.section === "memory" && focus.band !== undefined && summary.memory[focus.band] > 0) {
    specific = [companionLines.band0, companionLines.band1, companionLines.band2][focus.band] ?? [];
  }
  if (focus.section === "activity") {
    const day = summary.days.find(d => d.day === focus.day);
    if (day ? day.attempts === 0 : summary.week.attempts === 0) specific = companionLines.rest;
  }
  if (focus.section === "stages" && focus.level === "P") specific = companionLines.personal;
  const timeKey = hour === undefined ? null : hour < 5 ? "night" : hour < 11 ? "morning" : hour < 17 ? "afternoon" : hour < 22 ? "evening" : "night";
  const progress = progressLines(summary, focus);
  // Contextual progress is always first. Generic lines add variety, never repeat UI definitions.
  const extra = progress.length ? [...progress, ...companionLines[focus.section]] :
    [...specific, ...companionLines[focus.section], ...(focus.section === "overview" && timeKey ? companionLines[timeKey] : [])];
  const lines = progress.length
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
