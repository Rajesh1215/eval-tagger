// Seed data — ~15 realistic episodes spread across every bucket. All dates are
// generated relative to the runtime date so the demo always looks current.
import { addDays, sessionGap, todayISO } from "./derive";
import type { DB, Doc, Episode, Freq, PayMode, Payment, Session } from "./types";

// A believable "photo" for seeded docs (real uploads use object URLs).
function photoDataUrl(title: string, lines: string[]): string {
  const rows = lines
    .map(
      (t, i) =>
        `<text x="24" y="${120 + i * 34}" font-family="monospace" font-size="16" fill="#4b5563">${t}</text>`
    )
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420">` +
    `<rect width="320" height="420" fill="#fffdf7"/>` +
    `<rect x="0" y="0" width="320" height="64" fill="#eef2ef"/>` +
    `<text x="24" y="40" font-family="sans-serif" font-size="18" font-weight="bold" fill="#1c2320">${title}</text>` +
    rows +
    `<line x1="24" y1="380" x2="180" y2="380" stroke="#9ca3af"/>` +
    `<text x="24" y="400" font-family="sans-serif" font-size="12" fill="#9ca3af">signature</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface SessionSpec {
  count: number;
  freq: Freq;
  lastDaysAgo: number; // most recent session, days before today
  startPain: number;
  byIds: string[]; // rotated across sessions
  mods: string[];
  noteAt?: Record<number, string>; // session no → note
}

function mkSessions(today: string, spec: SessionSpec): Session[] {
  const { count, freq, lastDaysAgo, startPain, byIds, mods, noteAt } = spec;
  const gap = sessionGap(freq);
  const sessions: Session[] = [];
  for (let i = 1; i <= count; i++) {
    const date = addDays(today, -(lastDaysAgo + (count - i) * gap));
    // Pain trends down over the course with a small bump every 4th visit.
    const base = startPain - ((i - 1) * (startPain - 2)) / Math.max(count - 1, 1);
    const pain = Math.min(10, Math.max(1, Math.round(base) + (i % 4 === 0 ? 1 : 0)));
    sessions.push({
      no: i,
      date,
      pain,
      mods: i % 3 === 0 ? [...mods, "Manual"].slice(0, 4) : mods,
      byId: byIds[(i - 1) % byIds.length],
      notes: noteAt?.[i] ?? "",
    });
  }
  return sessions;
}

/** Turn a seeded "paid so far" total into believable payment rows. */
function mkPayments(paid: number, start: string, sessions: Session[], seq: number): Payment[] {
  if (paid <= 0) return [];
  const modes: PayMode[] = ["Cash", "UPI", "UPI", "Cash", "Card"];
  const mode = modes[seq % modes.length];
  // Larger amounts arrive in two installments — advance at intake, rest mid-course.
  if (paid > 3000 && sessions.length > 2) {
    const first = Math.round(paid / 2 / 100) * 100;
    return [
      { id: `pay${seq}a`, date: start, amount: first, mode, kind: "course", note: "Advance at intake" },
      { id: `pay${seq}b`, date: sessions[2].date, amount: paid - first, mode: mode === "Cash" ? "UPI" : "Cash", kind: "course", note: "" },
    ];
  }
  return [{ id: `pay${seq}a`, date: start, amount: paid, mode, kind: "course", note: "Advance at intake" }];
}

let epSeq = 0;
function ep(
  today: string,
  base: Omit<Episode, "id" | "sessions" | "docs" | "note" | "nudged" | "start" | "payments"> & {
    paid: number;
    consultFee?: number;
    startDaysAgo?: number; // used when there are no sessions to anchor the start date
    note?: string;
    nudged?: boolean;
    docs?: Doc[];
  },
  spec: Omit<SessionSpec, "freq">
): Episode {
  epSeq += 1;
  const { paid, consultFee, startDaysAgo, ...rest } = base;
  const sessions = mkSessions(today, { ...spec, freq: base.freq });
  const start = sessions.length
    ? addDays(sessions[0].date, -1)
    : addDays(today, -(startDaysAgo ?? 3));
  const payments = mkPayments(paid, start, sessions, epSeq);
  if (consultFee && consultFee > 0) {
    payments.unshift({
      id: `pay${epSeq}c`, date: start, amount: consultFee, mode: "UPI", kind: "consult", note: "Consult fee",
    });
  }
  return {
    id: `e${epSeq}`,
    note: "",
    nudged: false,
    docs: [],
    ...rest,
    payments,
    sessions,
    start,
  };
}

export function seed(): DB {
  epSeq = 0;
  const t = todayISO();

  const staff = [
    { id: "s1", name: "Dr. Sai Prasad", role: "physio" as const, active: true },
    { id: "s2", name: "Anjali Varma", role: "physio" as const, active: true },
    { id: "s3", name: "Rohit", role: "intern" as const, active: true },
    { id: "s4", name: "Priya", role: "intern" as const, active: true },
    // Interns rotate — records are deactivated, never deleted.
    { id: "s5", name: "Deepak", role: "intern" as const, active: false },
  ];

  const patients = [
    { id: "p1", name: "Suresh Kumar", phone: "98470 12345", age: 46, gender: "M" as const },
    { id: "p2", name: "Lakshmi Menon", phone: "98950 22110", age: 58, gender: "F" as const },
    { id: "p3", name: "Arjun Reddy", phone: "99620 88774", age: 24, gender: "M" as const },
    { id: "p4", name: "Ravi Shankar", phone: "94420 55678", age: 52, gender: "M" as const },
    { id: "p5", name: "Kamala Devi", phone: "98840 33221", age: 67, gender: "F" as const },
    // Same number as Suresh — one phone serves the family (duplicate-phone demo).
    { id: "p6", name: "Meena Kumar", phone: "98470 12345", age: 41, gender: "F" as const },
    { id: "p7", name: "Joseph Thomas", phone: "98460 77889", age: 38, gender: "M" as const },
    { id: "p8", name: "Anita Desai", phone: "99610 44556", age: 35, gender: "F" as const },
    { id: "p9", name: "Mohammed Farooq", phone: "96000 11223", age: 49, gender: "M" as const },
    { id: "p10", name: "Divya Nair", phone: "97890 66778", age: 55, gender: "F" as const },
    { id: "p11", name: "Prakash Rao", phone: "94980 99001", age: 63, gender: "M" as const },
    { id: "p12", name: "Sunita Sharma", phone: "98410 33445", age: 44, gender: "F" as const },
    { id: "p13", name: "Vignesh Iyer", phone: "99400 55667", age: 28, gender: "M" as const },
    { id: "p14", name: "Ganesh Murthy", phone: "94430 22334", age: 60, gender: "M" as const },
    { id: "p15", name: "Farida Begum", phone: "98860 88990", age: 50, gender: "F" as const },
    { id: "p16", name: "Rekha Pillai", phone: "97450 66112", age: 39, gender: "F" as const },
    { id: "p17", name: "Amit Jain", phone: "98200 44771", age: 33, gender: "M" as const },
  ];

  const episodes: Episode[] = [
    // ---- Today ----
    ep(
      t,
      {
        patientId: "p1", complaint: "Low back pain", doctor: "Dr. Rao (Ortho)",
        physioId: "s1", planned: 12, freq: 3, price: 7200, paid: 3600,
        next: t, status: "active",
        note: "Prefers evening slots. Works night shifts — remind on WhatsApp, not calls.",
      },
      { count: 5, lastDaysAgo: 2, startPain: 7, byIds: ["s1", "s3"], mods: ["IFT", "Exercise"],
        noteAt: { 4: "Pain spiked after long bus ride. Added hot pack before IFT." } }
    ),
    ep(
      t,
      {
        patientId: "p2", complaint: "Knee OA (L)", doctor: "Dr. Iyer (Ortho)",
        physioId: "s2", planned: 15, freq: 3, price: 9000, paid: 9000,
        next: t, status: "active",
      },
      { count: 8, lastDaysAgo: 2, startPain: 8, byIds: ["s2", "s4"], mods: ["Ultrasound", "Exercise"],
        noteAt: { 6: "Started stairs practice — 1 flight with rail." } }
    ),
    ep(
      t,
      {
        patientId: "p3", complaint: "Post-op ACL", doctor: "Dr. Rao (Ortho)",
        physioId: "s1", planned: 24, freq: 3, price: 14400, paid: 5000,
        next: t, status: "active",
        docs: [
          {
            id: "d1",
            url: photoDataUrl("Rx — Dr. Rao", ["Post-op ACL (R)", "Physio 24 sessions", "ROM + quads protocol", "Review after 4 weeks"]),
            note: "Dr. Rao prescription — post-op protocol",
          },
        ],
      },
      { count: 2, lastDaysAgo: 2, startPain: 6, byIds: ["s1", "s3"], mods: ["Exercise"] }
    ),
    // Already logged today → shows greyed "Recorded · pain X" in the Today list.
    ep(
      t,
      {
        patientId: "p6", complaint: "Cervical spondylosis", doctor: "Walk-in",
        physioId: "s2", planned: 10, freq: 3, price: 6000, paid: 3000,
        next: addDays(t, 2), status: "active",
      },
      { count: 5, lastDaysAgo: 0, startPain: 7, byIds: ["s2", "s4"], mods: ["TENS", "Exercise"] }
    ),

    // ---- Missed ----
    ep(
      t,
      {
        patientId: "p4", complaint: "Frozen shoulder", doctor: "Dr. Nair (Neuro)",
        physioId: "s1", planned: 15, freq: 3, price: 9000, paid: 4500,
        next: addDays(t, -3), status: "active",
      },
      { count: 6, lastDaysAgo: 5, startPain: 8, byIds: ["s1", "s4"], mods: ["Ultrasound", "Exercise"],
        noteAt: { 5: "External rotation improving, 40° → 55°." } }
    ),
    ep(
      t,
      {
        patientId: "p5", complaint: "Post-stroke rehab · home", doctor: "Dr. Nair (Neuro)",
        physioId: "s2", planned: 20, freq: 2, price: 16000, paid: 8000,
        next: addDays(t, -16), status: "active",
        note: "Home visits — son coordinates. Landline unreachable afternoons.",
        docs: [
          {
            id: "d2",
            url: photoDataUrl("MRI report", ["MRI Brain — infarct", "Left MCA territory", "Dated 8 weeks ago"]),
            note: "MRI report pg 1",
          },
        ],
      },
      { count: 4, lastDaysAgo: 19, startPain: 5, byIds: ["s2"], mods: ["Exercise", "Manual"] }
    ),
    ep(
      t,
      {
        patientId: "p7", complaint: "Tennis elbow", doctor: "Walk-in",
        physioId: "s2", planned: 10, freq: 2, price: 6000, paid: 6000,
        next: addDays(t, -1), status: "active",
      },
      { count: 3, lastDaysAgo: 4, startPain: 6, byIds: ["s2", "s3"], mods: ["Ultrasound", "Exercise"] }
    ),

    // ---- No date ----
    ep(
      t,
      {
        patientId: "p8", complaint: "Plantar fasciitis", doctor: "Dr. Menon (Physician)",
        physioId: "s1", planned: 10, freq: 3, price: 5000, paid: 2500,
        next: null, status: "active",
      },
      { count: 5, lastDaysAgo: 6, startPain: 6, byIds: ["s1", "s4"], mods: ["Ultrasound", "Exercise"] }
    ),
    ep(
      t,
      {
        patientId: "p9", complaint: "Low back pain", doctor: "Dr. Rao (Ortho)",
        physioId: "s1", planned: 8, freq: 1, price: 4800, paid: 1000,
        next: null, status: "active",
      },
      { count: 2, lastDaysAgo: 12, startPain: 7, byIds: ["s1"], mods: ["IFT", "Exercise"] }
    ),
    // Already nudged → shows the nudged chip.
    ep(
      t,
      {
        patientId: "p10", complaint: "Knee OA (B/L)", doctor: "Dr. Iyer (Ortho)",
        physioId: "s2", planned: 15, freq: 2, price: 9750, paid: 9750,
        next: null, status: "active", nudged: true,
      },
      { count: 7, lastDaysAgo: 8, startPain: 8, byIds: ["s2", "s3"], mods: ["IFT", "Exercise"] }
    ),

    // ---- Upcoming ----
    ep(
      t,
      {
        patientId: "p11", complaint: "Post-op TKR", doctor: "Dr. Rao (Ortho)",
        physioId: "s1", planned: 20, freq: 3, price: 15000, paid: 10000,
        next: addDays(t, 1), status: "active",
      },
      { count: 9, lastDaysAgo: 1, startPain: 8, byIds: ["s1", "s3"], mods: ["Exercise", "Manual"],
        noteAt: { 8: "Flexion 95°. Target 110° by session 12." } }
    ),
    ep(
      t,
      {
        patientId: "p12", complaint: "Sciatica", doctor: "Dr. Menon (Physician)",
        physioId: "s2", planned: 12, freq: 2, price: 7200, paid: 3600,
        next: addDays(t, 3), status: "active",
      },
      { count: 1, lastDaysAgo: 1, startPain: 8, byIds: ["s2"], mods: ["IFT", "Exercise"] }
    ),
    ep(
      t,
      {
        patientId: "p13", complaint: "Ankle sprain (R)", doctor: "Walk-in",
        physioId: "s1", planned: 8, freq: 3, price: 4000, paid: 4000,
        next: addDays(t, 1), status: "active",
      },
      { count: 4, lastDaysAgo: 2, startPain: 5, byIds: ["s1", "s4"], mods: ["Ultrasound", "Exercise"] }
    ),

    // ---- Completed / dropped ----
    ep(
      t,
      {
        patientId: "p14", complaint: "Shoulder impingement", doctor: "Dr. Iyer (Ortho)",
        physioId: "s2", planned: 12, freq: 3, price: 7200, paid: 7200,
        next: null, status: "completed",
      },
      { count: 12, lastDaysAgo: 10, startPain: 7, byIds: ["s2", "s3"], mods: ["Ultrasound", "Exercise"] }
    ),
    ep(
      t,
      {
        patientId: "p15", complaint: "Low back pain", doctor: "Dr. Menon (Physician)",
        physioId: "s1", planned: 12, freq: 2, price: 7800, paid: 3900,
        next: null, status: "dropped",
        note: "Stopped answering after session 5 — said pain was gone.",
      },
      { count: 5, lastDaysAgo: 45, startPain: 6, byIds: ["s1", "s5"], mods: ["IFT", "Exercise"] }
    ),
    // ---- Consultations (plan not yet decided) ----
    ep(
      t,
      {
        patientId: "p16", complaint: "Shoulder pain (R)", doctor: "Dr. Iyer (Ortho)",
        physioId: "s2", planned: 0, freq: 3, price: 0, paid: 0, consultFee: 400,
        next: null, status: "consult", startDaysAgo: 1,
        note: "Assessment done — likely impingement. Plan to be discussed after X-ray.",
      },
      { count: 0, lastDaysAgo: 0, startPain: 0, byIds: ["s2"], mods: [] }
    ),
    // Stale consult — paid the fee 6 days ago but never started the course.
    ep(
      t,
      {
        patientId: "p17", complaint: "Low back pain", doctor: "Walk-in",
        physioId: "s1", planned: 0, freq: 3, price: 0, paid: 0, consultFee: 500,
        next: null, status: "consult", startDaysAgo: 6,
        note: "Suggested 12 sessions. Wants to discuss with family first.",
      },
      { count: 0, lastDaysAgo: 0, startPain: 0, byIds: ["s1"], mods: [] }
    ),

    // Lakshmi's earlier episode → demos "Other episodes" on her detail view.
    ep(
      t,
      {
        patientId: "p2", complaint: "Ankle sprain (L)", doctor: "Walk-in",
        physioId: "s1", planned: 8, freq: 3, price: 4000, paid: 4000,
        next: null, status: "completed",
      },
      { count: 8, lastDaysAgo: 210, startPain: 6, byIds: ["s1", "s5"], mods: ["Ultrasound", "Exercise"] }
    ),
  ];

  return { staff, patients, episodes };
}
