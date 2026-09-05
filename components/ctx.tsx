"use client";
import { createContext, useContext } from "react";
import type { DB, Doc, Episode, Freq, Patient, PayKind, PayMode } from "@/lib/types";

export type DemoRole = "owner" | "reception";

export interface SessionInput {
  pain: number;
  mods: string[];
  byId: string;
  notes: string;
  next: string | null;
}

export interface PaymentInput {
  amount: number;
  date: string;
  mode: PayMode;
  kind: PayKind;
  note: string;
}

export interface ConsultInput {
  patientId?: string;
  name?: string;
  phone?: string;
  age?: number;
  complaint: string;
  doctor: string;
  physioId: string;
  fee: number;
  note: string;
  prescription?: { url: string; note: string } | null;
}

export interface StartCourseInput {
  planned: number;
  freq: Freq;
  price: number;
  paid: number;
  firstDate: string;
  physioId: string; // who runs the course — may differ from who consulted
  note: string; // the doc's plan, kept as the (single) episode note
}

export interface IntakeInput {
  // either an existing patient…
  patientId?: string;
  // …or a new one
  name?: string;
  phone?: string;
  age?: number;
  // episode fields
  complaint: string;
  doctor: string;
  physioId: string;
  planned: number;
  freq: Freq;
  price: number;
  paid: number;
  firstDate: string;
  note: string;
  prescription?: { url: string; note: string } | null;
}

export interface AppCtx {
  db: DB;
  today: string;
  role: DemoRole;

  // navigation / overlays
  openEpisode(id: string | null): void;
  openPatient(id: string | null): void;
  openIntake(patientId?: string): void;
  closeIntake(): void;
  openLogger(episodeId: string): void;
  openStartCourse(episodeId: string): void;
  openBookNext(episodeId: string): void;
  openNudge(episodeIds: string[]): void;
  toast(msg: string): void;

  // data actions (in-memory only; refresh = reset)
  logSession(episodeId: string, s: SessionInput): void;
  addPayment(episodeId: string, p: PaymentInput): void;
  bookNext(episodeId: string, date: string): void;
  markNudged(episodeIds: string[]): void;
  setEpisodeNote(episodeId: string, note: string): void;
  addDoc(episodeId: string, url: string): void;
  setDocNote(episodeId: string, docId: string, note: string): void;
  createIntake(input: IntakeInput): string; // returns new episode id
  createConsult(input: ConsultInput): string; // returns new episode id
  startCourse(episodeId: string, s: StartCourseInput): void;
  dropEpisode(episodeId: string): void;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}

export type { DB, Doc, Episode, Patient };
