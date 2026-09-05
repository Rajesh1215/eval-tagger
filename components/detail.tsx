"use client";
import { useRef, useState } from "react";
import {
  bucket, consultFeeOf, daysBetween, done, isAtRisk, outstanding, paidAhead, paidOf,
  patientOf, staffName,
} from "@/lib/derive";
import { fmtDay, inr } from "@/lib/format";
import type { Payment, Session } from "@/lib/types";
import { useApp } from "./ctx";
import { AddPayment } from "./overlays";

export function EpisodeDetail({ id }: { id: string }) {
  const {
    db, today, role, openEpisode, openLogger, openStartCourse, openBookNext, openNudge,
    dropEpisode, toast,
  } = useApp();
  const [paying, setPaying] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const e = db.episodes.find((x) => x.id === id);
  if (!e) return null;
  const p = patientOf(db, e);
  const n = done(e);
  const due = outstanding(e);
  const ahead = paidAhead(e);
  const others = db.episodes.filter((x) => x.patientId === e.patientId && x.id !== e.id);
  const active = e.status === "active";

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-bold leading-tight">{p.name}</h2>
          <span className="text-muted">
            {p.age != null ? `${p.age} · ` : ""}
            {p.phone}
          </span>
        </div>
        <div className="mt-1 text-sm text-muted">
          {e.complaint} · ref {e.doctor} · {staffName(db, e.physioId)}
        </div>
        {e.status !== "active" && (
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
              e.status === "consult"
                ? "bg-amber/10 text-amber-deep"
                : e.status === "completed"
                  ? "bg-soft text-accent"
                  : "bg-danger/10 text-danger"
            }`}
          >
            {e.status === "consult"
              ? "Consultation"
              : e.status === "completed"
                ? "Course completed"
                : "Dropped"}
          </span>
        )}
      </div>

      {/* consultation stage — plan not decided yet */}
      {e.status === "consult" && (
        <>
          <div className="rounded-[14px] border border-amber/40 bg-amber/5 p-4">
            <div className="text-sm font-semibold text-amber-deep">
              Waiting {daysBetween(e.start, today) === 0 ? "since today" : `${daysBetween(e.start, today)}d`} for course to start
            </div>
            <div className="tnum mt-1 text-sm text-muted">
              {consultFeeOf(e) > 0
                ? `Consult fee ${inr(consultFeeOf(e))} paid`
                : "Consult fee not recorded"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openStartCourse(e.id)}
              className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Start course
            </button>
            <button
              onClick={() => {
                if (confirmDrop) {
                  dropEpisode(e.id);
                  toast("Marked as not proceeding");
                } else {
                  setConfirmDrop(true);
                }
              }}
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                confirmDrop
                  ? "border-danger bg-danger/10 text-danger"
                  : "border-line text-muted hover:border-danger hover:text-danger"
              }`}
            >
              {confirmDrop ? "Tap again to confirm" : "Didn't proceed"}
            </button>
          </div>
        </>
      )}

      {/* progress */}
      {e.status !== "consult" && (
      <div className="rounded-[14px] border border-line bg-white p-4">
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: e.planned }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-[4px] ${i < n ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </div>
        <div className="tnum mt-2.5 text-sm">
          <span className="font-semibold">{n} of {e.planned} done</span>
          <span className="text-muted"> · {Math.max(0, e.planned - n)} left · </span>
          {due > 0 ? (
            <span className="font-semibold text-amber-deep">{inr(due)} due</span>
          ) : (
            <span className="font-semibold text-accent">fully paid</span>
          )}
          {ahead > 0 && role === "owner" && (
            <span className="text-muted"> · {inr(ahead)} paid ahead</span>
          )}
        </div>
        {e.price > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-2.5">
            <span className="tnum text-sm text-muted">
              Paid {inr(paidOf(e))} of {inr(e.price)}
            </span>
            <button
              onClick={() => setPaying(true)}
              className="rounded-full border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-soft"
            >
              + Add payment
            </button>
          </div>
        )}
      </div>
      )}

      {/* actions */}
      {active && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openLogger(e.id)}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Log session {n + 1}
          </button>
          {e.next === null && (
            <button
              onClick={() => openBookNext(e.id)}
              className="rounded-full border border-accent px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-soft"
            >
              Book next session
            </button>
          )}
          {isAtRisk(e, today) && !e.nudged && (
            <button
              onClick={() => openNudge([e.id])}
              className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold transition-colors hover:border-accent hover:bg-soft"
            >
              ⚡ WhatsApp nudge
            </button>
          )}
        </div>
      )}

      {active && e.next && (
        <div className="text-sm">
          <span className="text-muted">Next session · </span>
          <span className="font-semibold">
            {e.next === today ? "Today" : fmtDay(e.next)}
          </span>
          {bucket(e, today) === "missed" && <span className="font-semibold text-amber-deep"> (missed)</span>}
        </div>
      )}

      <PainChart sessions={e.sessions} />
      <EpisodeNote id={e.id} note={e.note} />
      <SessionsList sessions={e.sessions} />
      <PaymentsList payments={e.payments} />
      <Docs episodeId={e.id} />

      {paying && <AddPayment episodeId={e.id} onClose={() => setPaying(false)} />}

      {others.length > 0 && (
        <section>
          <SectionTitle>Other episodes</SectionTitle>
          <div className="overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="divide-y divide-line">
              {others.map((o) => (
                <button
                  key={o.id}
                  onClick={() => openEpisode(o.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-ground"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{o.complaint}</div>
                    <div className="text-sm text-muted">
                      {done(o)} of {o.planned} · started {fmtDay(o.start)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      o.status === "active"
                        ? "bg-soft text-accent"
                        : o.status === "consult"
                          ? "bg-amber/10 text-amber-deep"
                          : o.status === "completed"
                            ? "bg-line text-muted"
                            : "bg-danger/10 text-danger"
                    }`}
                  >
                    {o.status === "active"
                      ? "Active"
                      : o.status === "consult"
                        ? "Consult"
                        : o.status === "completed"
                          ? "Completed"
                          : "Dropped"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{children}</div>
  );
}

/** Hand-rolled inline SVG line of pain scores — appears from session 2. */
function PainChart({ sessions }: { sessions: Session[] }) {
  if (sessions.length < 2) return null;
  const ordered = [...sessions].sort((a, b) => a.no - b.no);
  const W = 300, H = 96, padX = 14, padTop = 10, padBottom = 18;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / (ordered.length - 1);
  const y = (pain: number) => padTop + ((10 - pain) * (H - padTop - padBottom)) / 10;
  const points = ordered.map((s, i) => `${x(i)},${y(s.pain)}`).join(" ");
  const last = ordered[ordered.length - 1];

  return (
    <section>
      <SectionTitle>Pain over sessions</SectionTitle>
      <div className="rounded-[14px] border border-line bg-white p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pain trend chart">
          {[0, 5, 10].map((v) => (
            <g key={v}>
              <line x1={padX} x2={W - padX} y1={y(v)} y2={y(v)} stroke="#e7e4dd" strokeWidth="1" />
              <text x={2} y={y(v) + 3} fontSize="8" fill="#68716b">{v}</text>
            </g>
          ))}
          <polyline points={points} fill="none" stroke="#0e7c66" strokeWidth="2" strokeLinejoin="round" />
          {ordered.map((s, i) => (
            <circle key={s.no} cx={x(i)} cy={y(s.pain)} r="3" fill="#0e7c66" />
          ))}
          <text
            x={Math.min(x(ordered.length - 1) + 6, W - 8)}
            y={y(last.pain) + 3}
            fontSize="9"
            fontWeight="bold"
            fill="#0e7c66"
          >
            {last.pain}
          </text>
          {ordered.map((s, i) => (
            <text key={s.no} x={x(i)} y={H - 4} fontSize="7" fill="#68716b" textAnchor="middle">
              S{s.no}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

function EpisodeNote({ id, note }: { id: string; note: string }) {
  const { setEpisodeNote, toast } = useApp();
  return (
    <section>
      <SectionTitle>Episode note</SectionTitle>
      <textarea
        defaultValue={note}
        rows={2}
        placeholder="One note for this episode — preferences, context, anything the team should know…"
        onBlur={(ev) => {
          if (ev.target.value !== note) {
            setEpisodeNote(id, ev.target.value);
            toast("Note saved ✓");
          }
        }}
        className="w-full resize-y rounded-[14px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
    </section>
  );
}

function SessionsList({ sessions }: { sessions: Session[] }) {
  const { db } = useApp();
  const [open, setOpen] = useState<number | null>(null);
  if (sessions.length === 0) return null;
  const newestFirst = [...sessions].sort((a, b) => b.no - a.no);
  return (
    <section>
      <SectionTitle>Sessions</SectionTitle>
      <div className="overflow-hidden rounded-[14px] border border-line bg-white">
        <div className="divide-y divide-line">
          {newestFirst.map((s) => (
            <div key={s.no}>
              <button
                onClick={() => setOpen(open === s.no ? null : s.no)}
                className="flex w-full items-center gap-2 p-3 text-left text-sm transition-colors hover:bg-ground"
              >
                <span className="tnum font-semibold">S{s.no}</span>
                <span className="text-muted">·</span>
                <span>{fmtDay(s.date)}</span>
                <span className="text-muted">·</span>
                <span className="tnum">pain {s.pain}</span>
                <span className="text-muted">·</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {s.mods.join(", ")} · {staffName(db, s.byId)}
                </span>
                <span className="text-muted">{open === s.no ? "▾" : "▸"}</span>
              </button>
              {open === s.no && (
                <div className="border-t border-line bg-ground px-3 py-2.5 text-sm">
                  {s.notes ? s.notes : <span className="italic text-muted">No session note.</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PaymentsList({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return null;
  const newestFirst = [...payments].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <section>
      <SectionTitle>Payments</SectionTitle>
      <div className="overflow-hidden rounded-[14px] border border-line bg-white">
        <div className="divide-y divide-line">
          {newestFirst.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-3 text-sm">
              <span className="tnum font-semibold">{inr(p.amount)}</span>
              <span className="text-muted">·</span>
              <span>{fmtDay(p.date)}</span>
              <span className="text-muted">·</span>
              <span className="text-muted">{p.mode}</span>
              {p.kind === "consult" && (
                <span className="rounded-full bg-amber/10 px-2 py-0.5 text-xs font-semibold text-amber-deep">
                  Consult fee
                </span>
              )}
              {p.note && p.kind !== "consult" && (
                <span className="min-w-0 flex-1 truncate text-right text-muted">{p.note}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Docs({ episodeId }: { episodeId: string }) {
  const { db, addDoc, setDocNote, toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const e = db.episodes.find((x) => x.id === episodeId)!;

  return (
    <section>
      <SectionTitle>Documents · photos</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        {e.docs.map((d) => (
          <figure key={d.id} className="flex flex-col gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.url}
              alt={d.note || "photo"}
              className="aspect-[3/4] w-full rounded-[10px] border border-line bg-white object-cover"
            />
            <input
              defaultValue={d.note}
              placeholder="Add note…"
              onBlur={(ev) => {
                if (ev.target.value !== d.note) {
                  setDocNote(episodeId, d.id, ev.target.value);
                  toast("Note saved ✓");
                }
              }}
              className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs outline-none focus:border-line focus:bg-white"
            />
          </figure>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="text-xs">Photo</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(ev) => {
            const file = ev.target.files?.[0];
            if (file) {
              addDoc(episodeId, URL.createObjectURL(file));
              toast("Photo added ✓");
            }
            ev.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
