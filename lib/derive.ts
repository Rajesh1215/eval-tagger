// Derivation rules — pure functions over the in-memory arrays (README §Derivation rules).
import type { DB, Episode } from "./types";

// ---- date helpers (local dates as YYYY-MM-DD strings; lexicographic compare works) ----

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Whole days from `a` to `b` (positive if b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

// ---- core derivations ----

export const done = (e: Episode): number => e.sessions.length;

export const lastVisit = (e: Episode): string =>
  e.sessions.length ? e.sessions.reduce((a, s) => (s.date > a ? s.date : a), e.sessions[0].date) : e.start;

export const perSession = (e: Episode): number => (e.planned > 0 ? e.price / e.planned : 0);

/** "to collect" */
export const outstanding = (e: Episode): number => Math.max(0, e.price - e.paid);

/** "paid, sessions not delivered" */
export const paidAhead = (e: Episode): number => Math.max(0, e.paid - perSession(e) * done(e));

/** ₹ at risk on one episode (used only for sorting/row display of at-risk rows). */
export const riskAmount = (e: Episode): number => outstanding(e) + paidAhead(e);

export const daysSinceLastVisit = (e: Episode, today: string): number =>
  daysBetween(lastVisit(e), today);

/** Frequency-relative quiet threshold: 3×/wk flags after ~4 days, 1×/wk after ~9. */
export const quietThreshold = (e: Episode): number => 7 / e.freq + 2;

export type Bucket = "today" | "missed" | "nodate" | "upcoming";

export function bucket(e: Episode, today: string): Bucket | null {
  if (e.status !== "active") return null; // Completed/All views handle those
  if (e.next === today) return "today";
  if (e.next !== null && e.next < today) return "missed";
  if (e.next === null) {
    return daysSinceLastVisit(e, today) > quietThreshold(e) ? "nodate" : null;
  }
  return "upcoming";
}

export const hasSessionOn = (e: Episode, iso: string): boolean =>
  e.sessions.some((s) => s.date === iso);

export const isAtRisk = (e: Episode, today: string): boolean => {
  const b = bucket(e, today);
  return b === "missed" || b === "nodate";
};

export const atRiskEpisodes = (db: DB, today: string): Episode[] =>
  db.episodes.filter((e) => isAtRisk(e, today));

/** Money headline: kept SPLIT — the two numbers mean opposite things. */
export function moneyAtRisk(db: DB, today: string): { toCollect: number; paidAhead: number } {
  const risk = atRiskEpisodes(db, today);
  return {
    toCollect: risk.reduce((sum, e) => sum + outstanding(e), 0),
    paidAhead: risk.reduce((sum, e) => sum + paidAhead(e), 0),
  };
}

// ---- tab lists (pure; components only render these) ----

export type Tab = "today" | "missed" | "nodate" | "upcoming" | "completed" | "all";

/** Today rows: due today and not yet logged, time-ordered (stable by name). */
export const todayRows = (db: DB, today: string): Episode[] =>
  db.episodes
    .filter((e) => bucket(e, today) === "today" && !hasSessionOn(e, today))
    .sort((a, b) => patientName(db, a).localeCompare(patientName(db, b)));

/** Rows already logged today — shown greyed under the Today list. */
export const recordedTodayRows = (db: DB, today: string): Episode[] =>
  db.episodes
    .filter((e) => e.status === "active" && hasSessionOn(e, today))
    .sort((a, b) => patientName(db, a).localeCompare(patientName(db, b)));

export const missedRows = (db: DB, today: string): Episode[] =>
  db.episodes
    .filter((e) => bucket(e, today) === "missed")
    .sort((a, b) => riskAmount(b) - riskAmount(a));

export const noDateRows = (db: DB, today: string): Episode[] =>
  db.episodes
    .filter((e) => bucket(e, today) === "nodate")
    .sort((a, b) => riskAmount(b) - riskAmount(a));

export const upcomingRows = (db: DB, today: string): Episode[] =>
  db.episodes
    .filter((e) => bucket(e, today) === "upcoming")
    .sort((a, b) => (a.next! < b.next! ? -1 : a.next! > b.next! ? 1 : 0));

export const completedRows = (db: DB): Episode[] =>
  db.episodes
    .filter((e) => e.status !== "active")
    .sort((a, b) => (lastVisit(b) < lastVisit(a) ? -1 : 1));

export const allRows = (db: DB): Episode[] =>
  [...db.episodes].sort((a, b) => patientName(db, a).localeCompare(patientName(db, b)));

export function tabCounts(db: DB, today: string): Record<Tab, number> {
  return {
    today: todayRows(db, today).length,
    missed: missedRows(db, today).length,
    nodate: noDateRows(db, today).length,
    upcoming: upcomingRows(db, today).length,
    completed: completedRows(db).length,
    all: db.episodes.length,
  };
}

// ---- small lookups ----

export function patientOf(db: DB, e: Episode) {
  return db.patients.find((p) => p.id === e.patientId)!;
}

export const patientName = (db: DB, e: Episode): string => patientOf(db, e)?.name ?? "";

export function staffName(db: DB, id: string): string {
  const s = db.staff.find((x) => x.id === id);
  if (!s) return "—";
  return s.role === "intern" ? `${s.name} (intern)` : s.name;
}

/** Default gap between sessions for a frequency, in days. */
export const sessionGap = (freq: number): number => Math.round(7 / freq);
