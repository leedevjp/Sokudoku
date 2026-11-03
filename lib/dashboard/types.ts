import type { Kind, EntryType } from "../game/types";
export type DashboardGroup = {
  entry_type: EntryType;
  kind: Kind;
  level: string;
  total: number;
  learned: number;
  review: number;
  memory: [number, number, number];
  attempts: number;
};
export type DashboardActivity = Pick<
  DashboardGroup,
  "entry_type" | "kind" | "level"
> & {
  day: string;
  attempts: number;
  correct: number;
  correct_ms: number;
};
export type DashboardData = {
  today: string;
  updated_at: string;
  groups: DashboardGroup[];
  activity: DashboardActivity[];
};
