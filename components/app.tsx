"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { seed } from "@/lib/seed";
import { todayISO } from "@/lib/derive";
import type { DB, Episode, Patient } from "@/lib/types";
import {
  Ctx, type AppCtx, type ConsultInput, type DemoRole, type IntakeInput,
  type PaymentInput, type SessionInput, type StartCourseInput,
} from "./ctx";
import { DemoBar, Header, Toast } from "./chrome";
import { Board } from "./board";
import { PatientDetail, PatientsList } from "./patients";
import { EpisodeDetail } from "./detail";
import { IntakeForm } from "./intake";
import { BookNext, SessionLogger, StartCourse, WhatsAppPreview } from "./overlays";
import type { Tab } from "@/lib/derive";

let idSeq = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${++idSeq}`;

export default function App() {
  // Render only after mount: seed dates are runtime-relative, so skip SSR markup.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [db, setDb] = useState<DB>(() => seed());
  const today = todayISO();

  const [role, setRole] = useState<DemoRole>("owner");
  const [view, setView] = useState<"board" | "patients">("board");
  const [tab, setTab] = useState<Tab>("today");
  const [selEp, setSelEp] = useState<string | null>(null);
  const [selPatient, setSelPatient] = useState<string | null>(null);
  const [intake, setIntake] = useState<{ patientId?: string } | null>(null);
  const [loggerEp, setLoggerEp] = useState<string | null>(null);
  const [startEp, setStartEp] = useState<string | null>(null);
  const [bookEp, setBookEp] = useState<string | null>(null);
  const [nudgeIds, setNudgeIds] = useState<string[] | null>(null);
  const [toastMsg, setToastMsg] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToastMsg({ id, msg });
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const updateEpisode = useCallback((id: string, fn: (e: Episode) => Episode) => {
    setDb((prev) => ({
      ...prev,
      episodes: prev.episodes.map((e) => (e.id === id ? fn(e) : e)),
    }));
  }, []);

  const resolvePatient = (input: {
    patientId?: string;
    name?: string;
    phone?: string;
    age?: number;
  }): { patientId: string; newPatient: Patient | null } => {
    if (input.patientId) return { patientId: input.patientId, newPatient: null };
    const p: Patient = {
      id: newId("p"),
      name: (input.name ?? "").trim(),
      phone: (input.phone ?? "").trim(),
      age: input.age,
    };
    return { patientId: p.id, newPatient: p };
  };

  const ctx: AppCtx = {
    db,
    today,
    role,

    openEpisode: (id) => setSelEp(id),
    openPatient: (id) => {
      setSelPatient(id);
      setSelEp(null);
    },
    openIntake: (patientId) => setIntake({ patientId }),
    closeIntake: () => setIntake(null),
    openLogger: (id) => setLoggerEp(id),
    openStartCourse: (id) => setStartEp(id),
    openBookNext: (id) => setBookEp(id),
    openNudge: (ids) => setNudgeIds(ids),
    toast,

    logSession: (episodeId, s: SessionInput) => {
      updateEpisode(episodeId, (e) => {
        const no = e.sessions.length + 1;
        const finished = no >= e.planned;
        return {
          ...e,
          sessions: [
            ...e.sessions,
            { no, date: today, pain: s.pain, mods: s.mods, byId: s.byId, notes: s.notes },
          ],
          next: finished ? null : s.next,
          status: finished ? "completed" : e.status,
        };
      });
    },

    addPayment: (episodeId, p: PaymentInput) =>
      updateEpisode(episodeId, (e) => ({
        ...e,
        payments: [...e.payments, { id: newId("pay"), ...p }],
      })),

    bookNext: (episodeId, date) => updateEpisode(episodeId, (e) => ({ ...e, next: date })),

    markNudged: (ids) =>
      setDb((prev) => ({
        ...prev,
        episodes: prev.episodes.map((e) => (ids.includes(e.id) ? { ...e, nudged: true } : e)),
      })),

    setEpisodeNote: (episodeId, note) => updateEpisode(episodeId, (e) => ({ ...e, note })),

    addDoc: (episodeId, url) =>
      updateEpisode(episodeId, (e) => ({
        ...e,
        docs: [...e.docs, { id: newId("d"), url, note: "" }],
      })),

    setDocNote: (episodeId, docId, note) =>
      updateEpisode(episodeId, (e) => ({
        ...e,
        docs: e.docs.map((d) => (d.id === docId ? { ...d, note } : d)),
      })),

    startCourse: (episodeId, s: StartCourseInput) =>
      updateEpisode(episodeId, (e) => ({
        ...e,
        planned: s.planned,
        freq: s.freq,
        price: s.price,
        status: "active",
        next: s.firstDate,
        payments:
          s.paid > 0
            ? [
                ...e.payments,
                { id: newId("pay"), date: today, amount: s.paid, mode: "Cash" as const, kind: "course" as const, note: "At course start" },
              ]
            : e.payments,
      })),

    dropEpisode: (episodeId) =>
      updateEpisode(episodeId, (e) => ({ ...e, status: "dropped", next: null })),

    createIntake: (input: IntakeInput) => {
      const { patientId, newPatient } = resolvePatient(input);
      const episodeId = newId("e");
      const episode: Episode = {
        id: episodeId,
        patientId,
        complaint: input.complaint.trim(),
        doctor: input.doctor,
        physioId: input.physioId,
        planned: input.planned,
        freq: input.freq,
        price: input.price,
        payments:
          input.paid > 0
            ? [{ id: newId("pay"), date: today, amount: input.paid, mode: "Cash" as const, kind: "course" as const, note: "Paid at intake" }]
            : [],
        next: input.firstDate,
        status: "active",
        note: "",
        sessions: [],
        docs: input.prescription
          ? [{ id: newId("d"), url: input.prescription.url, note: input.prescription.note }]
          : [],
        nudged: false,
        start: today,
      };
      setDb((prev) => ({
        ...prev,
        patients: newPatient ? [...prev.patients, newPatient] : prev.patients,
        episodes: [...prev.episodes, episode],
      }));
      return episodeId;
    },

    createConsult: (input: ConsultInput) => {
      const { patientId, newPatient } = resolvePatient(input);
      const episodeId = newId("e");
      const episode: Episode = {
        id: episodeId,
        patientId,
        complaint: input.complaint.trim(),
        doctor: input.doctor,
        physioId: input.physioId,
        planned: 0,
        freq: 3,
        price: 0,
        payments:
          input.fee > 0
            ? [{ id: newId("pay"), date: today, amount: input.fee, mode: "Cash" as const, kind: "consult" as const, note: "Consult fee" }]
            : [],
        next: null,
        status: "consult",
        note: input.note.trim(),
        sessions: [],
        docs: input.prescription
          ? [{ id: newId("d"), url: input.prescription.url, note: input.prescription.note }]
          : [],
        nudged: false,
        start: today,
      };
      setDb((prev) => ({
        ...prev,
        patients: newPatient ? [...prev.patients, newPatient] : prev.patients,
        episodes: [...prev.episodes, episode],
      }));
      return episodeId;
    },
  };

  const reset = () => {
    setDb(seed());
    setSelEp(null);
    setSelPatient(null);
    setIntake(null);
    setLoggerEp(null);
    setBookEp(null);
    setNudgeIds(null);
    setView("board");
    setTab("today");
    toast("Demo reset ✓");
  };

  // Topmost detail panel (right pane on desktop, slide-over on phone).
  const detail = intake ? (
    <IntakeForm key={intake.patientId ?? "new"} patientId={intake.patientId} />
  ) : selEp ? (
    <EpisodeDetail key={selEp} id={selEp} />
  ) : selPatient ? (
    <PatientDetail key={selPatient} id={selPatient} />
  ) : null;

  const popPanel = () => {
    if (intake) setIntake(null);
    else if (selEp) setSelEp(null);
    else setSelPatient(null);
  };

  if (!ready) return <div className="min-h-screen bg-ground" />;

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen">
        <DemoBar role={role} setRole={setRole} onReset={reset} />
        <div className="mx-auto w-full max-w-[1240px]">
          <Header view={view} setView={(v) => { setView(v); setSelEp(null); setSelPatient(null); }} />
          <div className="desk:flex desk:items-start">
            <div className="px-4 pb-28 desk:w-[420px] desk:shrink-0 desk:border-r desk:border-line desk:pr-5">
              {view === "board" ? <Board tab={tab} setTab={setTab} /> : <PatientsList />}
            </div>
            <div className="hidden desk:block desk:sticky desk:top-0 desk:max-h-screen desk:min-w-0 desk:flex-1 desk:overflow-y-auto desk:px-6 desk:py-5">
              {detail ?? (
                <div className="flex h-[60vh] items-center justify-center text-muted">
                  Select a patient to see the episode
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phone: detail slides over the list */}
        <div
          className={`fixed inset-0 z-40 overflow-y-auto bg-ground transition-transform duration-200 desk:hidden ${
            detail ? "translate-x-0" : "pointer-events-none translate-x-full"
          }`}
        >
          {detail && (
            <div className="px-4 pb-28">
              <button
                onClick={popPanel}
                className="sticky top-0 z-10 -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 border-b border-line bg-ground px-4 py-3 text-left font-medium"
              >
                <span aria-hidden>←</span> Back
              </button>
              <div className="pt-4">{detail}</div>
            </div>
          )}
        </div>

        {loggerEp && <SessionLogger episodeId={loggerEp} onClose={() => setLoggerEp(null)} />}
        {startEp && <StartCourse episodeId={startEp} onClose={() => setStartEp(null)} />}
        {bookEp && <BookNext episodeId={bookEp} onClose={() => setBookEp(null)} />}
        {nudgeIds && <WhatsAppPreview episodeIds={nudgeIds} onClose={() => setNudgeIds(null)} />}
        {toastMsg && <Toast key={toastMsg.id} msg={toastMsg.msg} />}
      </div>
    </Ctx.Provider>
  );
}
