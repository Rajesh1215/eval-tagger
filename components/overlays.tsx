"use client";
import { useState } from "react";
import { addDays, done, patientOf, sessionGap } from "@/lib/derive";
import { weekdayFull } from "@/lib/format";
import { CLINIC_NAME, MODALITIES } from "@/lib/types";
import { useApp } from "./ctx";

/** Bottom sheet on phone, centered modal on desktop. */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center desk:items-center">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl desk:w-[460px] desk:rounded-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold leading-tight">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted";

export function SessionLogger({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const { db, today, logSession, toast } = useApp();
  const e = db.episodes.find((x) => x.id === episodeId)!;
  const p = patientOf(db, e);
  const n = done(e) + 1;
  const lastPain = e.sessions.length ? e.sessions[e.sessions.length - 1].pain : 5;

  const [pain, setPain] = useState(lastPain);
  const [mods, setMods] = useState<string[]>(["Exercise"]);
  // The logged-in user is NOT assumed to be the treater — clinics share one device.
  const [byId, setById] = useState(e.physioId);
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState<string>(
    n >= e.planned ? "" : addDays(today, sessionGap(e.freq))
  );

  const activeStaff = db.staff.filter((s) => s.active);
  const willComplete = n >= e.planned;

  const doneClick = () => {
    logSession(episodeId, { pain, mods, byId, notes: notes.trim(), next: next || null });
    onClose();
    toast(willComplete ? "Course complete 🎉" : `Session ${n} recorded ✓`);
  };

  return (
    <Sheet title={`${p.name} · Session ${n} of ${e.planned}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label className={label}>
            Pain <span className="tnum text-base font-bold normal-case text-ink">{pain}</span>
            <span className="normal-case text-muted"> / 10</span>
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={pain}
            onChange={(ev) => setPain(Number(ev.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className={label}>Modalities</label>
          <div className="flex flex-wrap gap-2">
            {MODALITIES.map((m) => {
              const on = mods.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => setMods(on ? mods.filter((x) => x !== m) : [...mods, m])}
                  className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                    on
                      ? "border-accent bg-soft font-semibold text-accent"
                      : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={label}>Treated by</label>
          <select
            value={byId}
            onChange={(ev) => setById(ev.target.value)}
            className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.role === "intern" ? " (intern)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>Session note (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
            className="w-full resize-y rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>

        {!willComplete && (
          <div>
            <label className={label}>Next session</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={next}
                onChange={(ev) => setNext(ev.target.value)}
                className="tnum flex-1 rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
              {next && (
                <button onClick={() => setNext("")} className="text-sm text-muted hover:text-ink">
                  Clear
                </button>
              )}
            </div>
            {!next && (
              <div className="mt-1.5 text-xs text-amber-deep">
                Not booked — patient will show under “No date”.
              </div>
            )}
          </div>
        )}

        <button
          onClick={doneClick}
          className="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Done{willComplete ? " — completes the course" : ""}
        </button>
      </div>
    </Sheet>
  );
}

export function BookNext({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const { db, today, bookNext, toast } = useApp();
  const e = db.episodes.find((x) => x.id === episodeId)!;
  const p = patientOf(db, e);
  const [date, setDate] = useState(addDays(today, sessionGap(e.freq)));

  return (
    <Sheet title={`Book next session · ${p.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          className="tnum w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={() => {
            if (!date) return;
            bookNext(episodeId, date);
            onClose();
            toast("Session booked ✓");
          }}
          disabled={!date}
          className="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Book
        </button>
      </div>
    </Sheet>
  );
}

/** Non-clinical only — never diagnoses, treatment details, or progress claims. */
function nudgeMessage(name: string, remaining: number, today: string): string {
  const first = name.split(" ")[0];
  const day = weekdayFull(addDays(today, 1));
  return `Hi ${first}, you have ${remaining} session${remaining === 1 ? "" : "s"} remaining at ${CLINIC_NAME}. Shall we book you for ${day} 6pm? Reply here to confirm.`;
}

export function WhatsAppPreview({
  episodeIds,
  onClose,
}: {
  episodeIds: string[];
  onClose: () => void;
}) {
  const { db, today, markNudged, toast } = useApp();
  const eps = episodeIds
    .map((id) => db.episodes.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <Sheet
      title={eps.length > 1 ? `WhatsApp nudge · ${eps.length} patients` : "WhatsApp nudge"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="flex max-h-[45vh] flex-col gap-2.5 overflow-y-auto">
          {eps.map((e) => {
            const p = patientOf(db, e);
            return (
              <div key={e.id}>
                {eps.length > 1 && (
                  <div className="mb-1 text-xs font-semibold text-muted">
                    {p.name} · {p.phone}
                  </div>
                )}
                <div className="rounded-2xl rounded-bl-md bg-soft px-4 py-3 text-sm leading-relaxed">
                  {nudgeMessage(p.name, e.planned - done(e), today)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              markNudged(eps.map((e) => e.id));
              onClose();
              toast(eps.length > 1 ? `Sent ${eps.length} ✓` : "Sent ✓");
            }}
            className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Send{eps.length > 1 ? ` ${eps.length}` : ""}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
