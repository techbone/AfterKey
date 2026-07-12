"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

/**
 * The product's emotional core: time remaining until the vault becomes
 * claimable. Color decays green → amber → red as the deadline approaches.
 */
export function Countdown({
  deadline, // unix seconds when claimable
  totalSecs, // full period length, for the progress fraction
}: {
  deadline: number;
  totalSecs: number;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = deadline - now;
  const fraction = Math.min(1, Math.max(0, remaining / totalSecs));
  const color =
    remaining <= 0 ? "text-danger" : fraction < 0.1 ? "text-amber-400" : "text-pulse";
  const bar =
    remaining <= 0 ? "bg-danger" : fraction < 0.1 ? "bg-amber-400" : "bg-pulse";

  const d = Math.floor(remaining / 86_400);
  const h = Math.floor((remaining % 86_400) / 3_600);
  const m = Math.floor((remaining % 3_600) / 60);
  const s = remaining % 60;

  return (
    <div>
      {remaining > 0 ? (
        <div className={`font-display tabular-nums tracking-tight ${color}`}>
          <span className="text-6xl font-bold sm:text-7xl">
            {d > 0 ? `${d}d ${pad(h)}:${pad(m)}` : `${pad(h)}:${pad(m)}:${pad(s)}`}
          </span>
          {d > 0 && <span className="ml-2 text-2xl text-mist">:{pad(s)}</span>}
        </div>
      ) : (
        <div className="font-display text-5xl font-bold text-danger sm:text-6xl">
          Claimable now
        </div>
      )}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-edge">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${bar}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-mist">
        {remaining > 0
          ? "until your beneficiaries may start a claim"
          : "your beneficiaries can start a claim — check in to reset"}
      </p>
    </div>
  );
}
