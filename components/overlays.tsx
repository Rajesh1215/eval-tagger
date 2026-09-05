"use client";
import { useState } from "react";
import { addDays, daysBetween, done, outstanding, patientOf, sessionGap } from "@/lib/derive";
import { inr, weekdayFull } from "@/lib/format";
import { CLINIC_NAME, MODALITIES, PAY_MODES, type Freq, type PayMode } from "@/lib/types";
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

function ModeChips({ mode, setMode }: { mode: PayMode; setMode: (m: PayMode) => void }) {
  return (
    <div className="flex gap-2">
      {PAY_MODES.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            mode === m
              ? "border-accent bg-soft font-semibold text-accent"
              : "border-line text-muted hover:text-ink"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/** Mock payment recording — no gateway, just a row in payments[] (refresh = reset). */
export function AddPayment({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const { db, today, addPayment, toast } = useApp();
  const e = db.episodes.find((x) => x.id === episodeId)!;
  const p = patientOf(db, e);
  const due = outstanding(e);

  const [amount, setAmount] = useState(due > 0 ? String(due) : "");
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<PayMode>("UPI");
  const [note, setNote] = useState("");
  const amt = parseFloat(amount) || 0;

  return (
    <Sheet title={`Add payment · ${p.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {due > 0 ? (
          <div className="tnum text-sm text-muted">
            Balance <b className="text-amber-deep">{inr(due)}</b> of {inr(e.price)}
          </div>
        ) : (
          <div className="text-sm text-muted">Fully paid — extra amounts count as paid ahead.</div>
        )}
        <div>
          <label className={label}>Amount ₹</label>
          <input
            inputMode="numeric"
            autoFocus
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
            className="tnum w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-lg font-semibold outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className={label}>Mode</label>
          <ModeChips mode={mode} setMode={setMode} />
        </div>
        <div>
          <label className={label}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(ev) => setDate(ev.target.value)}
            className="tnum w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className={label}>Note (optional)</label>
          <input
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="e.g. balance for sessions 5–8"
            className="w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => {
            addPayment(episodeId, { amount: amt, date, mode, kind: "course", note: note.trim() });
            onClose();
            toast(`${inr(amt)} recorded ✓`);
          }}
          disabled={amt <= 0 || !date}
          className="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Record payment
        </button>
      </div>
    </Sheet>
  );
}

export function SessionLogger({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const { db, today, logSession, addPayment, toast } = useApp();
  const e = db.episodes.find((x) => x.id === episodeId)!;
  const p = patientOf(db, e);
  const n = done(e) + 1;
  const lastPain = e.sessions.length ? e.sessions[e.sessions.length - 1].pain : 5;
  const due = outstanding(e);

  const [pain, setPain] = useState(lastPain);
  const [mods, setMods] = useState<string[]>(["Exercise"]);
  // The logged-in user is NOT assumed to be the treater — clinics share one device.
  const [byId, setById] = useState(e.physioId);
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState<string>(
    n >= e.planned ? "" : addDays(today, sessionGap(e.freq))
  );
  const [collecting, setCollecting] = useState(false);
  const [collectAmt, setCollectAmt] = useState("");
  const [collectMode, setCollectMode] = useState<PayMode>("UPI");

  const activeStaff = db.staff.filter((s) => s.active);
  const willComplete = n >= e.planned;

  const doneClick = () => {
    logSession(episodeId, { pain, mods, byId, notes: notes.trim(), next: next || null });
    const amt = collecting ? parseFloat(collectAmt) || 0 : 0;
    if (amt > 0) {
      addPayment(episodeId, { amount: amt, date: today, mode: collectMode, kind: "course", note: `At session ${n}` });
    }
    onClose();
    const paidBit = amt > 0 ? ` · ${inr(amt)} collected` : "";
    toast(willComplete ? `Course complete 🎉${paidBit}` : `Session ${n} recorded${paidBit} ✓`);
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

        {!collecting ? (
          <button
            onClick={() => {
              setCollecting(true);
              setCollectAmt(due > 0 ? String(due) : "");
            }}
            className="self-start text-sm font-semibold text-accent hover:underline"
          >
            + Collect payment{due > 0 ? ` (balance ${inr(due)})` : ""}
          </button>
        ) : (
          <div>
            <label className={label}>
              Collect ₹{due > 0 && <span className="tnum normal-case text-muted"> · balance {inr(due)}</span>}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                inputMode="numeric"
                value={collectAmt}
                onChange={(ev) => setCollectAmt(ev.target.value)}
                placeholder="0"
                className="tnum w-28 rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm font-semibold outline-none focus:border-accent"
              />
              <ModeChips mode={collectMode} setMode={setCollectMode} />
              <button
                onClick={() => setCollecting(false)}
                className="text-sm text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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

/** Converts a consultation into an active course — plan decided, patient accepted. */
export function StartCourse({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const { db, today, startCourse, openEpisode, toast } = useApp();
  const e = db.episodes.find((x) => x.id === episodeId)!;
  const p = patientOf(db, e);
  const waiting = daysBetween(e.start, today);

  const [planned, setPlanned] = useState("12");
  const [freq, setFreq] = useState<Freq>(3);
  const [price, setPrice] = useState("");
  const [paid, setPaid] = useState("");
  const [firstDate, setFirstDate] = useState(addDays(today, 1));
  // Starts from the consult's assessment note so the doc extends it into the plan.
  const [note, setNote] = useState(e.note);
  const plannedN = parseInt(planned, 10) || 0;

  const fieldCls =
    "w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent";

  return (
    <Sheet title={`Start course · ${p.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="text-sm text-muted">
          {e.complaint} · consulted {waiting === 0 ? "today" : `${waiting}d ago`}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Sessions</label>
            <input
              inputMode="numeric"
              value={planned}
              onChange={(ev) => setPlanned(ev.target.value)}
              className={`${fieldCls} tnum`}
            />
          </div>
          <div>
            <label className={label}>Frequency</label>
            <select
              value={freq}
              onChange={(ev) => setFreq(Number(ev.target.value) as Freq)}
              className={fieldCls}
            >
              <option value={1}>1× per week</option>
              <option value={2}>2× per week</option>
              <option value={3}>3× per week</option>
            </select>
          </div>
          <div>
            <label className={label}>Package price ₹</label>
            <input
              inputMode="numeric"
              placeholder="7200"
              value={price}
              onChange={(ev) => setPrice(ev.target.value)}
              className={`${fieldCls} tnum`}
            />
          </div>
          <div>
            <label className={label}>Paid now ₹</label>
            <input
              inputMode="numeric"
              placeholder="0"
              value={paid}
              onChange={(ev) => setPaid(ev.target.value)}
              className={`${fieldCls} tnum`}
            />
          </div>
        </div>
        <div>
          <label className={label}>First session</label>
          <input
            type="date"
            value={firstDate}
            onChange={(ev) => setFirstDate(ev.target.value)}
            className={`${fieldCls} tnum`}
          />
        </div>
        <div>
          <label className={label}>Plan note</label>
          <textarea
            rows={3}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="e.g. 12 sessions 3×/wk — quads strengthening, review ROM at S6…"
            className={`${fieldCls} resize-y`}
          />
        </div>
        <button
          onClick={() => {
            startCourse(episodeId, {
              planned: plannedN,
              freq,
              price: parseFloat(price) || 0,
              paid: parseFloat(paid) || 0,
              firstDate,
              note,
            });
            onClose();
            openEpisode(episodeId);
            toast("Course started ✓");
          }}
          disabled={plannedN <= 0 || !firstDate}
          className="rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start course
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
