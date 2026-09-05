# eval-tagger — v0

> Working codename: **eval-tagger** (neutral on purpose). Internally this is the
> physiotherapy clinic app; product name is decided later.

A course-completion system for small physiotherapy clinics. Their business is selling
courses of sessions ("15 sessions, 3× a week"); the app's job is to make patients finish
them. It replaces the paper session card and flags patients who stop coming mid-course
before the revenue is lost.

**One-line pitch:** *"Your patients stop at session 6 of 15 and you find out too late.
This tells you the same day and messages them for you."*

---

## v0 constraints (important)

- **Frontend only. No backend, no database, no auth service.** All data lives in one
  in-memory JSON structure seeded at load. Refresh = reset. This is a demo to show
  physio clinic owners, not a production system.
- Data shapes MUST mirror the future database rows (tables below), and all list logic
  MUST be pure functions over those arrays — so v1 can swap in Postgres without
  touching components.
- **Next.js (App Router) + TypeScript + Tailwind.** Client components are fine
  everywhere in v0.
- **Mobile-first, responsive.** Phone: single column, detail slides over. Desktop
  (≥ ~880px): two-pane — list left (~420px), detail/intake right.
- Local git only. **No remote. Never push anywhere.**

---

## Domain background (read before coding)

- A physio prescribes a **course**: e.g. 12 sessions, 3×/week, ₹7,200 package.
  Patients pay upfront, per-session, or partially. Many stop coming once pain reduces
  (typically around session 5–7) — bad clinically (relapse) and financially.
- Sessions run in parallel: the physio rotates between 2–4 patients; interns set up
  machines (IFT, TENS, Ultrasound); reception ticks a paper card. Nobody clearly owns
  the session count — that's why tracking breaks.
- One patient can return years later with a new complaint → a patient has many
  **episodes**. Each episode = one complaint + one course of sessions + its own money.
- In India one phone number often serves a whole family. **Phone must NOT be unique.**
- Interns rotate every few months → staff records are never deleted, only deactivated.

---

## Data model (in-memory arrays, shaped like future tables)

```
staff       id, name, role('physio'|'intern'), active
patient     id, name, phone, age?, gender?
episode     id, patientId, complaint, doctor(referring, free text/select),
            physioId(primary), planned(sessions), freq(per week: 1|2|3),
            price, paid, next(ISO date|null), status('active'|'completed'|'dropped'),
            note(single free-text episode note), sessions[], docs[], nudged(bool)
session     no, date(ISO), pain(0–10), mods(string[]), byId(staff), notes(string)
doc         id, url(object URL), note(string)      // PHOTOS ONLY, one note per photo
```

Referring doctors: a constant list is fine for v0
(`Dr. Rao (Ortho)`, `Dr. Nair (Neuro)`, `Dr. Iyer (Ortho)`, `Dr. Menon (Physician)`, `Walk-in`).

Modalities: `IFT, TENS, Ultrasound, Exercise, Manual`.

Seed ~15 realistic episodes spread across all buckets (names, complaints like
"Knee OA (L)", "Post-op ACL", "Low back pain", "Post-stroke rehab · home"). Seed dates
**relative to the runtime date** so the demo always looks current. Include two patients
sharing one phone number to demo the duplicate-phone flow.

## Derivation rules (pure functions — the heart of the app)

```
done(e)        = e.sessions.length
lastVisit(e)   = date of last session (or episode start)
perSession(e)  = price / planned
outstanding(e) = max(0, price - paid)              // "to collect"
paidAhead(e)   = max(0, paid - perSession*done)    // "paid, sessions not delivered"

bucket(e):  status ≠ 'active'      → none (Completed/All views handle those)
            next == today          → Today
            next <  today          → Missed
            next == null AND daysSince(lastVisit) > (7/freq)+2   → No date
            next >  today          → Upcoming
```

The frequency-relative rule matters: a 3×/week patient is flagged after ~4 quiet days,
a 1×/week patient only after ~9. A fixed threshold would produce false alarms.

**At-risk = Missed + No date.** Money headline = Σ outstanding + Σ paidAhead over
at-risk episodes, shown SPLIT into "not yet collected" and "paid, sessions not
delivered" — never merged into one number called "unused" (they mean opposite things).

---

## Screens

### 1. Main board (home)
- Header: clinic name, date, **+ New patient** button.
- **Owner strip** (owner role only): big ₹ total tied up in incomplete courses,
  at-risk patient count, split into the two money categories.
- **Six tabs with counts: Today · Missed · No date · Upcoming · Completed · All.**
  - Today: time-ordered rows, "Session N of M", balance due chip, one-tap ✓ →
    opens session logger. Rows already logged today show greyed "Recorded · pain X".
  - Missed / No date: sorted by ₹ at risk desc; amber left stripe (red ≥14 days
    absent); per-row money cell ("₹X to collect" / "₹X paid ahead"); ⚡ nudge button
    per row (→ WhatsApp preview) + "Nudge all N" button. Nudged rows show a chip.
  - Upcoming: grouped by day (Tomorrow, Mon 8 Sep …).
  - Completed: finished/dropped episodes, most recent first.
  - All: every episode, searchable is a bonus.
- Tapping any row (not its action button) opens the episode detail.

### 2. Episode detail (right pane / slide-over)
- Patient name, age, phone, complaint, referring doctor, primary physio.
- Session progress boxes (■■■■■□□…), "N of M done · X left · ₹Y due / fully paid".
- Action row: **Log session N** · **Book next session** (if no next date) ·
  **WhatsApp nudge** (if at risk, hidden once nudged).
- Next session date if set.
- **Pain chart**: small inline SVG line of pain scores across sessions (hand-rolled,
  no chart library). Appears from session 2.
- **Episode note**: ONE free-text note at episode level, editable inline (textarea,
  save on blur). No note types, no categories.
- **Sessions list** (newest first): "S6 · Wed 3 Sep · pain 5 · IFT, Exercise ·
  Rohit (intern)". Tapping a session expands its session note inline.
- **Documents**: PHOTOS ONLY. Grid of thumbnails; + button opens file picker
  (accept="image/*", capture). Each photo has ONE free-text note under it (inline
  input, save on blur). No document types, no other file kinds, nothing else.
- **Other episodes** of the same patient listed at bottom; tap to switch.

### 3. Patients view
- Toggle in the header or nav: **Board | Patients**.
- Search box (name / phone), list rows: name, phone, active-episode summary.
- Tap → patient detail: info + all episodes + **Add episode** button
  (opens intake with patient preselected, phone/name fields skipped).

### 4. Intake — Add patient / Add episode (one form)
- Phone first. On ≥6 digits, live duplicate check: "2 patients found with this
  number" → pick an existing patient (= new episode for them) or
  "＋ Different person, same number" (= new patient). NEVER auto-merge, NEVER block.
- Fields: name, age, referred by (select), chief complaint, sessions (number),
  frequency (1×/2×/3× per week), package price ₹, paid now ₹, primary physio
  (select), first session date (default tomorrow), optional prescription PHOTO
  (goes into episode docs with a note).
- Save → creates patient (if new) + episode, toast "Episode created ✓ WhatsApp
  welcome queued", opens the episode detail.

### 5. Session logger (bottom sheet on phone, centered modal on desktop)
- Title "Name · Session N of M".
- Pain slider 0–10 (defaults to last recorded pain).
- Modality chips (multi-select, Exercise pre-selected).
- **Treated by**: select over active staff, defaulted to the episode's primary
  physio, interns labelled "(intern)". The logged-in user is NOT assumed to be the
  treater — clinics share one device.
- Session note (optional textarea).
- Next session date (date input, defaulted to today + round(7/freq) days; clearable —
  empty = not booked → patient will flow into "No date").
- Done → appends session, sets next, toast. If done == planned → status 'completed',
  toast "Course complete 🎉".

### 6. Small overlays
- **Book next session**: date picker modal for "No date" patients.
- **WhatsApp preview**: shows the exact message + Cancel/Send (Send = mock: toast
  "Sent ✓", mark nudged). Message template — NON-CLINICAL ONLY, e.g.:
  "Hi Suresh, you have 9 sessions remaining at Sai Physio. Shall we book you for
  Monday 6pm? Reply here to confirm."
  Never put diagnoses, treatment details, or progress claims in a WhatsApp message.
- **Toast** for every action.

## Roles (demo toggle, not real auth)

A demo bar above the app: **Owner | Reception** toggle + **Reset demo** button.
- Owner: sees everything including the money strip.
- Reception: same lists, same PER-PATIENT balances (they collect the money), but NO
  clinic-wide totals / aggregates strip.
No per-physio performance stats anywhere in v0 (politics in a 3-person clinic).

---

## Design

- Palette: warm off-white app ground `#FBFAF8`, ink `#1C2320`, muted `#68716B`,
  line `#E7E4DD`, accent viridian `#0E7C66` (+ soft `#E3F1ED`), warning amber
  `#D97706`/`#A16207`, danger `#B3261E`, dark money-strip panel `#10231E`.
- Font: **Schibsted Grotesk** (Google Fonts) with system-ui fallback,
  `font-variant-numeric: tabular-nums` wherever numbers align.
- ₹ formatting: Indian grouping (`toLocaleString('en-IN')`).
- Feel: calm, card-based, rounded-14 cards, generous tap targets (the intern in a
  curtained cubicle with a phone is the real user). Semantic color only for state
  (amber/red stripes), accent for actions.

## Out of scope for v0 (do NOT build)

Backend/DB · auth · payment gateway · patient-facing app · real WhatsApp sending ·
appointment calendar/slots (derive from freq instead) · EMR/clinical notes beyond the
two free-text notes · insurance/TPA · staff payroll/attendance · per-physio analytics ·
multi-branch · document types · non-photo files · OCR · localStorage persistence.

## Definition of done (v0)

Runs with `npm run dev`. On a phone: open board → tap ✓ on a Today row → log a
session in <15 seconds → patient moves out of Today. Missed tab shows ₹ at risk and
sends a (mock) nudge. + New patient with a duplicate phone shows the picker. An
episode shows pain chart, editable episode note, expandable session notes, photo
docs with per-photo notes. Owner/Reception toggle changes money visibility.
Everything resets on refresh.
