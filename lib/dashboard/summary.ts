import type { DashboardData, DashboardGroup } from "./types";
import type { EntryType, Kind } from "../game/types";

export type DashboardSummary = ReturnType<typeof dashboardSummary>;

/** Shared filters keep headline numbers, stage rows and charts on the same scope. */
export function dashboardSummary(
  data: DashboardData,
  entry: EntryType,
  kind: Kind,
) {
  const groups = data.groups.filter(
    (g) => g.entry_type === entry && g.kind === kind,
  );
  const activity = data.activity.filter(
    (g) => g.entry_type === entry && g.kind === kind,
  );
  const zero = {
    total: 0,
    learned: 0,
    review: 0,
    attempts: 0,
    memory: [0, 0, 0] as [number, number, number],
  };
  const sum = (rows: DashboardGroup[]) =>
    rows.reduce(
      (a, g) => ({
        total: a.total + g.total,
        learned: a.learned + g.learned,
        review: a.review + g.review,
        attempts: a.attempts + g.attempts,
        memory: a.memory.map((n, i) => n + g.memory[i]) as [
          number,
          number,
          number,
        ],
      }),
      { ...zero, memory: [...zero.memory] as [number, number, number] },
    );
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(data.today + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - 6 + i);
    const day = date.toISOString().slice(0, 10);
    const rows = activity.filter((a) => a.day === day);
    return {
      day,
      attempts: rows.reduce((n, a) => n + a.attempts, 0),
      correct: rows.reduce((n, a) => n + a.correct, 0),
      correct_ms: rows.reduce((n, a) => n + a.correct_ms, 0),
      timed_correct: rows.reduce((n, a) => n + (a.timed_correct ?? a.correct), 0),
    };
  });
  const week = days.reduce(
    (n, d) => ({
      attempts: n.attempts + d.attempts,
      correct: n.correct + d.correct,
      correct_ms: n.correct_ms + d.correct_ms,
      timed_correct: n.timed_correct + d.timed_correct,
    }),
    { attempts: 0, correct: 0, correct_ms: 0, timed_correct: 0 },
  );
  return {
    ...sum(groups),
    groups,
    days,
    week,
    common: sum(groups.filter((g) => g.level !== "P")),
    personal: sum(groups.filter((g) => g.level === "P")),
    hasAnyHistory: data.groups.some((g) => g.learned > 0 || g.attempts > 0),
  };
}

/** Round display shares without making their total 99% or 101%. */
export function percentageShares(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((n) => (n / total) * 100);
  const shares = exact.map(Math.floor);
  const order = exact
    .map((n, i) => ({ i, fraction: n - shares[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const remaining = 100 - shares.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) shares[order[i].i]++;
  return shares;
}
