"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  HOODIE_FALLBACK_SIZES,
  HOODIE_LEAD_MAX,
  HOODIE_NOTE_MAX,
  HOODIE_REMIND_LEADS,
  HOODIE_SCORE_MARKS,
  formatDropWhen,
  hoodieRemindAt,
  hoodieScoreMark,
  normalizeHoodieSize,
  type HoodieNoteIntent,
} from "@/lib/hoodieReminders";
import { compareSizeLabels } from "@/lib/productSizesDisplay";

function ScoreFace({ score }: { score: number }) {
  const step = Math.max(0, Math.min(10, Math.round(score / 2) * 2));
  const mouth =
    step <= 2
      ? "M8 17.2c1.15-1.7 2.5-2.5 4-2.5s2.85.8 4 2.5"
      : step === 4
        ? "M8.2 16.2h7.6"
        : step === 6
          ? "M8.2 15c1.15 1.15 2.45 1.7 3.8 1.7s2.65-.55 3.8-1.7"
          : "M7.4 14.4c1.45 2.15 3 3.15 4.6 3.15s3.15-1 4.6-3.15";

  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      {step === 0 ? (
        <>
          <path d="M5.6 7.1 9.2 8.7" />
          <path d="M18.4 7.1 14.8 8.7" />
          <circle cx="8.6" cy="11" r="1.05" fill="currentColor" stroke="none" />
          <circle cx="15.4" cy="11" r="1.05" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <path d="M5.8 9.1 9.2 7.6" />
          <path d="M18.2 9.1 14.8 7.6" />
          <circle cx="8.6" cy="11.2" r="1.05" fill="currentColor" stroke="none" />
          <circle cx="15.4" cy="11.2" r="1.05" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {step === 4 || step === 6 ? (
        <>
          <circle cx="8.6" cy="10.6" r="1.05" fill="currentColor" stroke="none" />
          <circle cx="15.4" cy="10.6" r="1.05" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {step === 8 ? (
        <path
          d="M12 18.8S6.2 15.2 6.2 11.4C6.2 8.6 8.3 6.8 10.4 6.8c1.15 0 2 .55 2.6 1.25.6-.7 1.45-1.25 2.6-1.25 2.1 0 4.2 1.8 4.2 4.6 0 3.8-5.8 7.4-5.8 7.4z"
          fill="currentColor"
          stroke="none"
        />
      ) : null}
      {step === 10 ? (
        <path
          d="m12 4.4 1.7 4.15 4.55.4-3.45 2.9 1.05 4.45L12 14.15 8.15 16.3l1.05-4.45-3.45-2.9 4.55-.4z"
          fill="currentColor"
          stroke="none"
        />
      ) : null}
      {step < 8 ? <path d={mouth} /> : null}
    </svg>
  );
}

type LeadUnit = "min" | "hour";
type LeadMode = "preset" | "custom";

const UNIT_STEP: Record<LeadUnit, number> = { min: 1, hour: 60 };

function leadCopy(minutes: number) {
  const preset = HOODIE_REMIND_LEADS.find((item) => item.minutes === minutes);
  if (preset) return minutes === 0 ? "At the drop" : `${preset.label} before`;
  if (minutes <= 0) return "At the drop";
  if (minutes < 60) return `${minutes} min before`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour before" : `${hours} hours before`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} min before`;
  return mins ? `${hours}h ${mins}m before` : `${hours} hours before`;
}

function unitAmountMax(unit: LeadUnit, maxLead: number) {
  return Math.max(0, Math.floor(maxLead / UNIT_STEP[unit]));
}

function amountFromLead(lead: number, unit: LeadUnit) {
  return Math.max(0, Math.round(lead / UNIT_STEP[unit]));
}

export function HoodieDropReminder({
  slug,
  name,
  releaseAt,
  sizes = [],
}: {
  slug: string;
  name: string;
  releaseAt: string;
  sizes?: string[];
}) {
  const sizeOptions = useMemo(() => {
    const unique = [...new Set(sizes.map((size) => normalizeHoodieSize(size)).filter(Boolean))];
    const list = unique.length ? unique : [...HOODIE_FALLBACK_SIZES];
    return [...list].sort(compareSizeLabels);
  }, [sizes]);

  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState(10);
  const [leadMode, setLeadMode] = useState<LeadMode>("preset");
  const [unit, setUnit] = useState<LeadUnit>("min");
  const [score, setScore] = useState(8);
  const [size, setSize] = useState(sizeOptions[0] ?? "M");
  const [intent, setIntent] = useState<HoodieNoteIntent>("change");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sizeOptions.length) return;
    if (sizeOptions.includes(size)) return;
    setSize(sizeOptions[0]);
  }, [size, sizeOptions]);

  const maxLead = useMemo(() => {
    const release = Date.parse(releaseAt);
    if (!Number.isFinite(release)) return 0;
    return Math.min(HOODIE_LEAD_MAX, Math.max(0, Math.floor((release - Date.now()) / 60_000)));
  }, [releaseAt, open]);

  const leadOptions = useMemo(
    () => HOODIE_REMIND_LEADS.filter((item) => item.minutes <= maxLead),
    [maxLead],
  );

  const customMax = unitAmountMax(unit, maxLead);
  const customAmount = Math.min(customMax, amountFromLead(lead, unit));
  const canCustom = maxLead > 0;

  useEffect(() => {
    setLead((current) => Math.min(current, maxLead));
  }, [maxLead]);

  useEffect(() => {
    if (leadMode !== "preset") return;
    if (leadOptions.some((item) => item.minutes === lead)) return;
    const preferred = leadOptions.find((item) => item.minutes === 10) ?? leadOptions[0];
    if (preferred) setLead(preferred.minutes);
    else setLead(0);
  }, [lead, leadMode, leadOptions]);

  const pickPreset = (minutes: number) => {
    setLeadMode("preset");
    setLead(minutes);
  };

  const pickCustom = () => {
    if (!canCustom) return;
    setLeadMode("custom");
    const nextUnit: LeadUnit = lead >= 60 && lead % 60 === 0 ? "hour" : "min";
    const max = unitAmountMax(nextUnit, maxLead);
    const amount = Math.min(max, Math.max(1, amountFromLead(lead || 30, nextUnit)));
    setUnit(nextUnit);
    setLead(amount * UNIT_STEP[nextUnit]);
  };

  const setCustomAmount = (raw: number) => {
    const max = unitAmountMax(unit, maxLead);
    const amount = Math.min(max, Math.max(unit === "min" ? 0 : 1, Math.round(raw) || 0));
    setLeadMode("custom");
    setLead(amount * UNIT_STEP[unit]);
  };

  const pickUnit = (next: LeadUnit) => {
    const max = unitAmountMax(next, maxLead);
    if (max < (next === "min" ? 0 : 1)) return;
    const amount = Math.min(max, Math.max(next === "min" ? 0 : 1, amountFromLead(lead, next) || 1));
    setUnit(next);
    setLeadMode("custom");
    setLead(amount * UNIT_STEP[next]);
  };

  const remindAt = useMemo(() => hoodieRemindAt(releaseAt, lead), [releaseAt, lead]);
  const remindLabel = remindAt ? formatDropWhen(remindAt.toISOString()) : "";
  const mark = hoodieScoreMark(score);
  const customActive = leadMode === "custom" || !leadOptions.some((item) => item.minutes === lead);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const save = async () => {
    if (!size) {
      setStatus("error");
      setError("Choose a size.");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/hoodie-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug, leadMinutes: lead, note, score, intent, size }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setError(data.error || "Could not save.");
        return;
      }
      setStatus("saved");
    } catch {
      setStatus("error");
      setError("Could not save.");
    }
  };

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="hoodie-pop" role="presentation" onClick={() => setOpen(false)}>
            <div
              className={`hoodie-pop__card${customActive && status !== "saved" ? " hoodie-pop__card--custom" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="hoodie-pop-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="hoodie-pop__close" onClick={() => setOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />
                </svg>
              </button>

              <div className="hoodie-pop__scroll">
                {status === "saved" ? (
                  <div className="hoodie-pop__done">
                    <span
                      className={`hoodie-pop__mark hoodie-pop__mark--done hoodie-pop__mark--s${mark.score} is-on`}
                      aria-hidden
                    >
                      <ScoreFace score={mark.score} />
                    </span>
                    <p className="hoodie-pop__kicker">You’re on the list</p>
                    <h2 id="hoodie-pop-title" className="hoodie-pop__title">
                      We’ll email you {leadCopy(lead).toLowerCase()}.
                    </h2>
                    <p className="hoodie-pop__meta">
                      Size {size}
                      {remindLabel ? ` · ${remindLabel}` : ""}
                    </p>
                    <button type="button" className="hoodie-pop__submit hoodie-pop__submit--block" onClick={() => setOpen(false)}>
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                  <header className="hoodie-pop__head">
                    <p className="hoodie-pop__kicker">Notify me</p>
                    <h2 id="hoodie-pop-title" className="hoodie-pop__title">
                      {name}
                    </h2>
                  </header>

                  <section className="hoodie-pop__section" aria-label="Size">
                    <div className="hoodie-pop__row">
                      <span className="hoodie-pop__label">Size</span>
                      <strong className="hoodie-pop__value">{size || "Pick one"}</strong>
                    </div>
                    <div className="hoodie-pop__sizes" role="radiogroup" aria-label="Waitlist size">
                      {sizeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={size === option}
                          className={size === option ? "is-on" : ""}
                          onClick={() => setSize(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="hoodie-pop__section" aria-label="Hoodie score">
                      <div className="hoodie-pop__row">
                        <span className="hoodie-pop__label">Score</span>
                        <strong className={`hoodie-pop__value hoodie-pop__value--s${mark.score}`}>
                          {mark.label}
                          <em>{score}/10</em>
                        </strong>
                      </div>
                      <div className="hoodie-pop__marks">
                        {HOODIE_SCORE_MARKS.map((item) => (
                          <button
                            key={item.score}
                            type="button"
                            className={`hoodie-pop__tone--s${item.score}${item.score === mark.score ? " is-on" : ""}`}
                            aria-label={`${item.score} ${item.label}`}
                            onClick={() => setScore(item.score)}
                          >
                            <span className={`hoodie-pop__mark hoodie-pop__mark--s${item.score}`}>
                              <ScoreFace score={item.score} />
                            </span>
                            <em>{item.label}</em>
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="hoodie-pop__section" aria-label="Email time">
                      <div className="hoodie-pop__row">
                        <span className="hoodie-pop__label">Remind</span>
                        <strong className="hoodie-pop__value">{leadCopy(lead)}</strong>
                      </div>
                      <div className="hoodie-pop__chips hoodie-pop__chips--remind" role="radiogroup" aria-label="Reminder timing">
                        {leadOptions.map((item) => (
                          <button
                            key={item.minutes}
                            type="button"
                            role="radio"
                            aria-checked={!customActive && lead === item.minutes}
                            className={!customActive && lead === item.minutes ? "is-on" : ""}
                            onClick={() => pickPreset(item.minutes)}
                          >
                            {item.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={customActive}
                          className={customActive ? "is-on" : ""}
                          disabled={!canCustom}
                          onClick={pickCustom}
                        >
                          Custom
                        </button>
                      </div>

                      {customActive ? (
                        <div className="hoodie-pop__custom" aria-label="Custom reminder time">
                          <div className="hoodie-pop__stepper">
                            <button
                              type="button"
                              aria-label="Decrease"
                              disabled={customAmount <= (unit === "min" ? 0 : 1)}
                              onClick={() => setCustomAmount(customAmount - 1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={unit === "min" ? 0 : 1}
                              max={Math.max(customMax, 1)}
                              value={customAmount}
                              aria-label={unit === "min" ? "Minutes before drop" : "Hours before drop"}
                              onChange={(event) => setCustomAmount(Number(event.target.value))}
                            />
                            <button
                              type="button"
                              aria-label="Increase"
                              disabled={customAmount >= customMax}
                              onClick={() => setCustomAmount(customAmount + 1)}
                            >
                              +
                            </button>
                          </div>
                          <div className="hoodie-pop__units" role="tablist" aria-label="Time unit">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={unit === "min"}
                              className={unit === "min" ? "is-on" : ""}
                              onClick={() => pickUnit("min")}
                            >
                              Min
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={unit === "hour"}
                              className={unit === "hour" ? "is-on" : ""}
                              disabled={unitAmountMax("hour", maxLead) < 1}
                              onClick={() => pickUnit("hour")}
                            >
                              Hour
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <p className="hoodie-pop__meta">{remindLabel || "At the drop"}</p>
                    </section>

                    <section className="hoodie-pop__section hoodie-pop__section--form" aria-label="Note and email">
                      <div className="hoodie-pop__intent">
                        <span className="hoodie-pop__label">Feedback</span>
                        <div className="hoodie-pop__segment" role="radiogroup" aria-label="What is the note for">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={intent === "change"}
                            className={intent === "change" ? "is-on" : ""}
                            onClick={() => setIntent("change")}
                          >
                            Change this
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={intent === "new"}
                            className={intent === "new" ? "is-on" : ""}
                            onClick={() => setIntent("new")}
                          >
                            New like this
                          </button>
                        </div>
                      </div>

                      <label className="hoodie-pop__field">
                        <span className="hoodie-pop__field-top">
                          <span className="hoodie-pop__label">Note</span>
                          <em>
                            {note.length}/{HOODIE_NOTE_MAX}
                          </em>
                        </span>
                        <textarea
                          value={note}
                          maxLength={HOODIE_NOTE_MAX}
                          rows={3}
                          placeholder={intent === "new" ? "What should the new piece be?" : "Tell us what to change…"}
                          onChange={(event) => setNote(event.target.value.slice(0, HOODIE_NOTE_MAX))}
                        />
                      </label>

                      <div className="hoodie-pop__cta">
                        <label className="hoodie-pop__field">
                          <span className="hoodie-pop__label">Email</span>
                          <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={email}
                            placeholder="you@email.com"
                            required
                            onChange={(event) => setEmail(event.target.value)}
                          />
                        </label>
                        {error ? <p className="hoodie-pop__error">{error}</p> : null}
                      <button
                        type="button"
                        className="hoodie-pop__submit hoodie-pop__submit--block"
                        disabled={status === "saving" || !email.trim() || !size}
                        onClick={save}
                      >
                        {status === "saving" ? "Sending…" : "Send reminder"}
                      </button>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button type="button" className="btn btn--coming-soon w-full" onClick={() => setOpen(true)}>
        {status === "saved" ? "Reminder saved" : "Notify me"}
      </button>
      {dialog}
    </>
  );
}
