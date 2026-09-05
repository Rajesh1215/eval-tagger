"use client";
import { useRef, useState } from "react";
import { addDays } from "@/lib/derive";
import { DOCTORS } from "@/lib/types";
import type { Freq } from "@/lib/types";
import { useApp } from "./ctx";

const field =
  "w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wider text-muted";

export function IntakeForm({ patientId }: { patientId?: string }) {
  const { db, today, createIntake, createConsult, closeIntake, openEpisode, toast } = useApp();
  const fixed = patientId ? db.patients.find((p) => p.id === patientId) : undefined;

  // Two paths: plan already fixed → start the course now; otherwise register a consult.
  const [path, setPath] = useState<"course" | "consult">("course");
  const [fee, setFee] = useState("");
  const [consultNote, setConsultNote] = useState("");
  const [phone, setPhone] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [dupDismissed, setDupDismissed] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [doctor, setDoctor] = useState<string>(DOCTORS[0]);
  const [complaint, setComplaint] = useState("");
  const [planned, setPlanned] = useState("12");
  const [freq, setFreq] = useState<Freq>(3);
  const [price, setPrice] = useState("");
  const [paid, setPaid] = useState("");
  const [physioId, setPhysioId] = useState(
    db.staff.find((s) => s.role === "physio" && s.active)?.id ?? ""
  );
  const [firstDate, setFirstDate] = useState(addDays(today, 1));
  const [rx, setRx] = useState<{ url: string; note: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const chosen = chosenId ? db.patients.find((p) => p.id === chosenId) : undefined;
  const existingPatient = fixed ?? chosen;

  const digits = phone.replace(/\D/g, "");
  const matches =
    !fixed && !chosen && digits.length >= 6
      ? db.patients.filter((p) => p.phone.replace(/\D/g, "").includes(digits))
      : [];
  const physios = db.staff.filter((s) => s.role === "physio" && s.active);

  const plannedN = parseInt(planned, 10) || 0;
  const baseOk =
    (existingPatient || name.trim().length > 0) && complaint.trim().length > 0 && physioId !== "";
  const canSave =
    path === "consult" ? baseOk : baseOk && plannedN > 0 && firstDate !== "";

  const save = () => {
    if (!canSave) return;
    const patientFields = {
      patientId: existingPatient?.id,
      name: name.trim(),
      phone,
      age: age ? parseInt(age, 10) : undefined,
    };
    if (path === "consult") {
      const id = createConsult({
        ...patientFields,
        complaint,
        doctor,
        physioId,
        fee: parseFloat(fee) || 0,
        note: consultNote,
        prescription: rx,
      });
      closeIntake();
      openEpisode(id);
      toast("Consult registered ✓");
      return;
    }
    const id = createIntake({
      ...patientFields,
      complaint,
      doctor,
      physioId,
      planned: plannedN,
      freq,
      price: parseFloat(price) || 0,
      paid: parseFloat(paid) || 0,
      firstDate,
      prescription: rx,
    });
    closeIntake();
    openEpisode(id);
    toast("Episode created ✓ WhatsApp welcome queued");
  };

  return (
    <div className="flex max-w-[460px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          {fixed ? `New episode · ${fixed.name}` : "New patient"}
        </h2>
        <button onClick={closeIntake} className="text-sm text-muted hover:text-ink">
          Cancel
        </button>
      </div>

      <div className="flex overflow-hidden rounded-full border border-line bg-white text-sm">
        {(
          [
            ["course", "Start course now"],
            ["consult", "Consult first"],
          ] as const
        ).map(([key, lbl]) => (
          <button
            key={key}
            onClick={() => setPath(key)}
            className={`flex-1 px-3 py-2 transition-colors ${
              path === key ? "bg-soft font-semibold text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Phone first — drives the live duplicate check */}
      {!fixed && (
        <div>
          <label className={label}>Phone</label>
          <input
            className={`${field} tnum`}
            inputMode="tel"
            placeholder="98470 12345"
            value={phone}
            autoFocus
            onChange={(ev) => {
              setPhone(ev.target.value);
              setDupDismissed(false);
            }}
          />
          {matches.length > 0 && !dupDismissed && (
            <div className="mt-2 rounded-[10px] border border-amber/50 bg-amber/5 p-3">
              <div className="mb-2 text-sm font-semibold text-amber-deep">
                {matches.length} patient{matches.length > 1 ? "s" : ""} found with this number
              </div>
              <div className="flex flex-col gap-1.5">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setChosenId(p.id)}
                    className="flex items-center justify-between rounded-[10px] border border-line bg-white px-3 py-2 text-left text-sm transition-colors hover:border-accent"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-muted">
                      {p.age != null ? `${p.age} · ` : ""}
                      {p.phone}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => setDupDismissed(true)}
                  className="rounded-[10px] border border-dashed border-line px-3 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  ＋ Different person, same number
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {chosen && (
        <div className="flex items-center justify-between rounded-[10px] bg-soft px-3.5 py-2.5 text-sm">
          <span>
            Existing patient: <b>{chosen.name}</b>
            {chosen.age != null ? ` · ${chosen.age}` : ""} — this adds a new episode
          </span>
          <button
            onClick={() => setChosenId(null)}
            aria-label="Clear selected patient"
            className="ml-2 font-bold text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {!existingPatient && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={label}>Name</label>
            <input className={field} value={name} onChange={(ev) => setName(ev.target.value)} />
          </div>
          <div>
            <label className={label}>Age</label>
            <input
              className={`${field} tnum`}
              inputMode="numeric"
              value={age}
              onChange={(ev) => setAge(ev.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <label className={label}>Referred by</label>
        <select className={field} value={doctor} onChange={(ev) => setDoctor(ev.target.value)}>
          {DOCTORS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={label}>Chief complaint</label>
        <input
          className={field}
          placeholder="e.g. Knee OA (L), Low back pain…"
          value={complaint}
          onChange={(ev) => setComplaint(ev.target.value)}
        />
      </div>

      {path === "course" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Sessions</label>
            <input
              className={`${field} tnum`}
              inputMode="numeric"
              value={planned}
              onChange={(ev) => setPlanned(ev.target.value)}
            />
          </div>
          <div>
            <label className={label}>Frequency</label>
            <select
              className={field}
              value={freq}
              onChange={(ev) => setFreq(Number(ev.target.value) as Freq)}
            >
              <option value={1}>1× per week</option>
              <option value={2}>2× per week</option>
              <option value={3}>3× per week</option>
            </select>
          </div>
          <div>
            <label className={label}>Package price ₹</label>
            <input
              className={`${field} tnum`}
              inputMode="numeric"
              placeholder="7200"
              value={price}
              onChange={(ev) => setPrice(ev.target.value)}
            />
          </div>
          <div>
            <label className={label}>Paid now ₹</label>
            <input
              className={`${field} tnum`}
              inputMode="numeric"
              placeholder="0"
              value={paid}
              onChange={(ev) => setPaid(ev.target.value)}
            />
          </div>
          <div>
            <label className={label}>Primary physio</label>
            <select className={field} value={physioId} onChange={(ev) => setPhysioId(ev.target.value)}>
              {physios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>First session</label>
            <input
              type="date"
              className={`${field} tnum`}
              value={firstDate}
              onChange={(ev) => setFirstDate(ev.target.value)}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Consult fee ₹</label>
              <input
                className={`${field} tnum`}
                inputMode="numeric"
                placeholder="400"
                value={fee}
                onChange={(ev) => setFee(ev.target.value)}
              />
            </div>
            <div>
              <label className={label}>Primary physio</label>
              <select className={field} value={physioId} onChange={(ev) => setPhysioId(ev.target.value)}>
                {physios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Assessment note (optional)</label>
            <textarea
              rows={2}
              className={`${field} resize-y`}
              placeholder="Findings, suggested plan, what happens next…"
              value={consultNote}
              onChange={(ev) => setConsultNote(ev.target.value)}
            />
          </div>
          <div className="rounded-[10px] bg-soft px-3.5 py-2.5 text-sm text-muted">
            The course plan (sessions, price) is set later from the Consults tab, once the
            patient accepts it.
          </div>
        </>
      )}

      <div>
        <label className={label}>Prescription photo (optional)</label>
        {rx ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rx.url}
              alt="prescription"
              className="h-24 w-20 rounded-[10px] border border-line object-cover"
            />
            <div className="flex-1">
              <input
                className={field}
                value={rx.note}
                onChange={(ev) => setRx({ ...rx, note: ev.target.value })}
                placeholder="Note for this photo"
              />
              <button onClick={() => setRx(null)} className="mt-1.5 text-xs text-muted hover:text-danger">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-[10px] border border-dashed border-line px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
          >
            + Add photo
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) setRx({ url: URL.createObjectURL(f), note: "Prescription" });
            ev.target.value = "";
          }}
        />
      </div>

      <button
        onClick={save}
        disabled={!canSave}
        className="mt-1 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {path === "consult" ? "Register consult" : "Save episode"}
      </button>
    </div>
  );
}
