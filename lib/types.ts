// Data shapes mirror the future database rows (see README).
// All list logic must be pure functions over these arrays.

export type StaffRole = "physio" | "intern";

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  phone: string; // NOT unique — one number often serves a whole family
  age?: number;
  gender?: "M" | "F";
}

export interface Session {
  no: number;
  date: string; // ISO YYYY-MM-DD
  pain: number; // 0–10
  mods: string[];
  byId: string; // staff id
  notes: string;
}

export interface Doc {
  id: string;
  url: string; // object URL (photos only)
  note: string; // one free-text note per photo
}

export type EpisodeStatus = "active" | "completed" | "dropped";
export type Freq = 1 | 2 | 3;

export interface Episode {
  id: string;
  patientId: string;
  complaint: string;
  doctor: string; // referring doctor, free text / select
  physioId: string; // primary physio
  planned: number; // sessions in the course
  freq: Freq; // per week
  price: number;
  paid: number;
  next: string | null; // ISO date of next session, null = not booked
  status: EpisodeStatus;
  note: string; // single free-text episode note
  sessions: Session[];
  docs: Doc[];
  nudged: boolean;
  start: string; // ISO date the episode was created (lastVisit fallback)
}

export interface DB {
  staff: Staff[];
  patients: Patient[];
  episodes: Episode[];
}

export const DOCTORS = [
  "Dr. Rao (Ortho)",
  "Dr. Nair (Neuro)",
  "Dr. Iyer (Ortho)",
  "Dr. Menon (Physician)",
  "Walk-in",
] as const;

export const MODALITIES = ["IFT", "TENS", "Ultrasound", "Exercise", "Manual"] as const;

export const CLINIC_NAME = "Sai Physio";
