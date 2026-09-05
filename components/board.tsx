"use client";
import { useState } from "react";
import {
  allRows, atRiskEpisodes, completedRows, daysSinceLastVisit, done, hasSessionOn,
  lastVisit, missedRows, moneyAtRisk, noDateRows, outstanding, paidAhead, patientOf,
  recordedTodayRows, tabCounts, todayRows, upcomingRows, type Tab,
} from "@/lib/derive";
import { fmtDay, inr, upcomingLabel } from "@/lib/format";
import type { Episode } from "@/lib/types";
import { useApp } from "./ctx";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "missed", label: "Missed" },
  { key: "nodate", label: "No date" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export function Board({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { db, today, role } = useApp();
  const counts = tabCounts(db, today);

  return (
    <div className="flex flex-col gap-4">
      {role === "owner" && <OwnerStrip />}

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5 pb-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                tab === key
                  ? "border-accent bg-soft font-semibold text-accent"
                  : "border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {label} <span className="tnum">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "today" && <TodayList />}
      {tab === "missed" && <AtRiskList kind="missed" />}
      {tab === "nodate" && <AtRiskList kind="nodate" />}
      {tab === "upcoming" && <UpcomingList />}
      {tab === "completed" && <CompletedList />}
      {tab === "all" && <AllList />}
    </div>
  );
}

function OwnerStrip() {
  const { db, today } = useApp();
  const { toCollect, paidAhead: ahead } = moneyAtRisk(db, today);
  const atRiskCount = new Set(atRiskEpisodes(db, today).map((e) => e.patientId)).size;
  return (
    <section className="rounded-[14px] bg-panel p-4 text-white">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="tnum text-3xl font-bold tracking-tight">{inr(toCollect + ahead)}</div>
          <div className="mt-0.5 text-sm text-white/60">tied up in incomplete courses</div>
        </div>
        <div className="text-right">
          <div className="tnum text-3xl font-bold tracking-tight">{atRiskCount}</div>
          <div className="mt-0.5 text-sm text-white/60">patients at risk</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/15 pt-3 text-sm">
        <div>
          <div className="tnum font-semibold">{inr(toCollect)}</div>
          <div className="text-white/60">not yet collected</div>
        </div>
        <div>
          <div className="tnum font-semibold">{inr(ahead)}</div>
          <div className="text-white/60">paid, sessions not delivered</div>
        </div>
      </div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[14px] border border-dashed border-line p-8 text-center text-muted">{text}</div>;
}

// ---- Today ----

function TodayList() {
  const { db, today, openEpisode, openLogger } = useApp();
  const rows = todayRows(db, today);
  const recorded = recordedTodayRows(db, today);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 && recorded.length === 0 && <Empty text="No sessions due today 🎉" />}
      {rows.length > 0 && (
        <Card>
          {rows.map((e) => {
            const p = patientOf(db, e);
            const due = outstanding(e);
            return (
              <button
                key={e.id}
                onClick={() => openEpisode(e.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-ground"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-sm text-muted">
                    {e.complaint} · Session {done(e) + 1} of {e.planned}
                  </div>
                </div>
                {due > 0 && (
                  <span className="tnum whitespace-nowrap rounded-full bg-amber-deep/10 px-2.5 py-1 text-xs font-semibold text-amber-deep">
                    {inr(due)} due
                  </span>
                )}
                <span
                  role="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openLogger(e.id);
                  }}
                  aria-label={`Log session for ${p.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-lg font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  ✓
                </span>
              </button>
            );
          })}
        </Card>
      )}
      {recorded.length > 0 && (
        <div>
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Recorded today
          </div>
          <Card>
            {recorded.map((e) => {
              const p = patientOf(db, e);
              const s = e.sessions.find((x) => x.date === today);
              return (
                <button
                  key={e.id}
                  onClick={() => openEpisode(e.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left opacity-55 transition-colors hover:bg-ground"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-sm text-muted">
                      Recorded · pain {s?.pain} · Session {s?.no} of {e.planned}
                    </div>
                  </div>
                  <span className="text-accent">✓</span>
                </button>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

// ---- Missed / No date (at-risk) ----

function AtRiskList({ kind }: { kind: "missed" | "nodate" }) {
  const { db, today, openEpisode, openNudge } = useApp();
  const rows = kind === "missed" ? missedRows(db, today) : noDateRows(db, today);
  const unNudged = rows.filter((e) => !e.nudged);

  if (rows.length === 0)
    return <Empty text={kind === "missed" ? "Nobody has missed a session" : "Everyone has a next date booked"} />;

  return (
    <div className="flex flex-col gap-3">
      {unNudged.length > 1 && (
        <button
          onClick={() => openNudge(unNudged.map((e) => e.id))}
          className="self-end rounded-full border border-accent px-3.5 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-soft"
        >
          ⚡ Nudge all {unNudged.length}
        </button>
      )}
      <Card>
        {rows.map((e) => {
          const p = patientOf(db, e);
          const absent = daysSinceLastVisit(e, today);
          const toCollect = outstanding(e);
          const ahead = paidAhead(e);
          return (
            <button
              key={e.id}
              onClick={() => openEpisode(e.id)}
              className={`flex w-full items-center gap-3 border-l-4 p-3.5 pl-3 text-left transition-colors hover:bg-ground ${
                absent >= 14 ? "border-l-danger" : "border-l-amber"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-sm text-muted">
                  {e.complaint} · S{done(e)} of {e.planned} · last visit {absent}d ago
                </div>
              </div>
              <div className="tnum shrink-0 text-right text-sm">
                {toCollect > 0 && <div className="font-semibold text-amber-deep">{inr(toCollect)} to collect</div>}
                {ahead > 0 && <div className="font-semibold text-danger">{inr(ahead)} paid ahead</div>}
              </div>
              {e.nudged ? (
                <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  Nudged ⚡
                </span>
              ) : (
                <span
                  role="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openNudge([e.id]);
                  }}
                  aria-label={`Nudge ${p.name}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-base transition-colors hover:border-accent hover:bg-soft"
                >
                  ⚡
                </span>
              )}
            </button>
          );
        })}
      </Card>
    </div>
  );
}

// ---- Upcoming ----

function UpcomingList() {
  const { db, today, openEpisode } = useApp();
  const rows = upcomingRows(db, today);
  if (rows.length === 0) return <Empty text="Nothing booked ahead yet" />;

  const groups = new Map<string, Episode[]>();
  for (const e of rows) {
    const key = e.next!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([date, eps]) => (
        <div key={date}>
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
            {upcomingLabel(date, today)}
          </div>
          <Card>
            {eps.map((e) => {
              const p = patientOf(db, e);
              return (
                <button
                  key={e.id}
                  onClick={() => openEpisode(e.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-ground"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-sm text-muted">
                      {e.complaint} · Session {done(e) + 1} of {e.planned}
                    </div>
                  </div>
                  {hasSessionOn(e, today) && <span className="text-sm text-accent">✓ today</span>}
                </button>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}

// ---- Completed ----

function CompletedList() {
  const { db, openEpisode } = useApp();
  const rows = completedRows(db);
  if (rows.length === 0) return <Empty text="No finished courses yet" />;
  return (
    <Card>
      {rows.map((e) => {
        const p = patientOf(db, e);
        return (
          <button
            key={e.id}
            onClick={() => openEpisode(e.id)}
            className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-ground"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{p.name}</div>
              <div className="truncate text-sm text-muted">
                {e.complaint} · {done(e)} of {e.planned} · last {fmtDay(lastVisit(e))}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                e.status === "completed" ? "bg-soft text-accent" : "bg-danger/10 text-danger"
              }`}
            >
              {e.status === "completed" ? "Completed" : "Dropped"}
            </span>
          </button>
        );
      })}
    </Card>
  );
}

// ---- All ----

function AllList() {
  const { db, today, openEpisode } = useApp();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const rows = allRows(db).filter((e) => {
    if (!query) return true;
    const p = patientOf(db, e);
    return (
      p.name.toLowerCase().includes(query) ||
      e.complaint.toLowerCase().includes(query) ||
      (digits.length >= 3 && p.phone.replace(/\D/g, "").includes(digits))
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, phone, complaint…"
        className="w-full rounded-[14px] border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      {rows.length === 0 ? (
        <Empty text="No matches" />
      ) : (
        <Card>
          {rows.map((e) => {
            const p = patientOf(db, e);
            const active = e.status === "active";
            return (
              <button
                key={e.id}
                onClick={() => openEpisode(e.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-ground"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-sm text-muted">
                    {e.complaint} · S{done(e)} of {e.planned}
                    {active && e.next ? ` · next ${fmtDay(e.next)}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    active
                      ? "bg-soft text-accent"
                      : e.status === "completed"
                        ? "bg-line text-muted"
                        : "bg-danger/10 text-danger"
                  }`}
                >
                  {active ? "Active" : e.status === "completed" ? "Completed" : "Dropped"}
                </span>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
