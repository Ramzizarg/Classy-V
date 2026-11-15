"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 4000;

/** Slim strip above the store header; phrases come from Dashboard → Home → banner phrases. */
export function AnnouncementBar({ phrases }: { phrases: string[] }) {
  const items = phrases.map((phrase) => phrase.trim()).filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  if (items.length === 0) return null;
  const current = items[index % items.length];

  return (
    <div
      className="site-announce"
      role="region"
      aria-label="Announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p key={current} className="site-announce__text" aria-live="polite">
        {current}
      </p>
    </div>
  );
}
