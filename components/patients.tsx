"use client";
import { useState } from "react";
import { done } from "@/lib/derive";
import { fmtDay } from "@/lib/format";
import { useApp } from "./ctx";

export function PatientsList() {
  const { db, openPatient } = useApp();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");

  const patients = [...db.patients]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((p) => {
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        (digits.length >= 3 && p.phone.replace(/\D/g, "").includes(digits))
      );
    });

  return (
    <div className="flex flex-col gap-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or phone…"
        className="w-full rounded-[14px] border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-accent"
      />
      <div className="overflow-hidden rounded-[14px] border border-line bg-white">
        <div className="divide-y divide-line">
          {patients.map((p) => {
            const active = db.episodes.find((e) => e.patientId === p.id && e.status === "active");
            return (
              <button
                key={p.id}
                onClick={() => openPatient(p.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-ground"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="tnum truncate text-sm text-muted">{p.phone}</div>
                </div>
                <div className="shrink-0 text-right text-sm text-muted">
                  {active ? (
                    <>
                      <div className="max-w-[160px] truncate">{active.complaint}</div>
                      <div className="tnum">
                        S{done(active)} of {active.planned}
                      </div>
                    </>
                  ) : (
                    "No active course"
                  )}
                </div>
              </button>
            );
          })}
          {patients.length === 0 && (
            <div className="p-8 text-center text-muted">No patients match</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PatientDetail({ id }: { id: string }) {
  const { db, openEpisode, openIntake } = useApp();
  const p = db.patients.find((x) => x.id === id);
  if (!p) return null;
  const episodes = [...db.episodes]
    .filter((e) => e.patientId === p.id)
    .sort((a, b) => (a.start < b.start ? 1 : -1));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold leading-tight">{p.name}</h2>
        <div className="tnum mt-1 text-muted">
          {p.age != null ? `${p.age} · ` : ""}
          {p.phone}
        </div>
      </div>

      <button
        onClick={() => openIntake(p.id)}
        className="self-start rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        + Add episode
      </button>

      <section>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Episodes
        </div>
        <div className="overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="divide-y divide-line">
            {episodes.map((e) => (
              <button
                key={e.id}
                onClick={() => openEpisode(e.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-ground"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.complaint}</div>
                  <div className="tnum text-sm text-muted">
                    {done(e)} of {e.planned} · started {fmtDay(e.start)}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    e.status === "active"
                      ? "bg-soft text-accent"
                      : e.status === "completed"
                        ? "bg-line text-muted"
                        : "bg-danger/10 text-danger"
                  }`}
                >
                  {e.status === "active" ? "Active" : e.status === "completed" ? "Completed" : "Dropped"}
                </span>
              </button>
            ))}
            {episodes.length === 0 && (
              <div className="p-6 text-center text-sm text-muted">No episodes yet</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
