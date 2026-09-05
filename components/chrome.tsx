"use client";
import { CLINIC_NAME } from "@/lib/types";
import { fmtDay } from "@/lib/format";
import { useApp, type DemoRole } from "./ctx";

export function DemoBar({
  role,
  setRole,
  onReset,
}: {
  role: DemoRole;
  setRole: (r: DemoRole) => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-panel text-white/90">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-3 px-4 py-1.5 text-xs">
        <span className="uppercase tracking-wider text-white/50">Demo</span>
        <div className="flex overflow-hidden rounded-full border border-white/25">
          {(["owner", "reception"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-3 py-1 capitalize transition-colors ${
                role === r ? "bg-white/90 font-semibold text-panel" : "hover:bg-white/10"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={onReset}
          className="ml-auto rounded-full border border-white/25 px-3 py-1 hover:bg-white/10"
        >
          Reset demo
        </button>
      </div>
    </div>
  );
}

export function Header({
  view,
  setView,
}: {
  view: "board" | "patients";
  setView: (v: "board" | "patients") => void;
}) {
  const { today, openIntake } = useApp();
  return (
    <header className="flex flex-wrap items-center gap-3 px-4 py-4">
      <div className="mr-auto">
        <h1 className="text-xl font-bold leading-tight">{CLINIC_NAME}</h1>
        <div className="text-sm text-muted">{fmtDay(today)}</div>
      </div>
      <div className="flex overflow-hidden rounded-full border border-line bg-white text-sm">
        {(["board", "patients"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 capitalize transition-colors ${
              view === v ? "bg-soft font-semibold text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <button
        onClick={() => openIntake()}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        + New patient
      </button>
    </header>
  );
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-lg">
        {msg}
      </div>
    </div>
  );
}
