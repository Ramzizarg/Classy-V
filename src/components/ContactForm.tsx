"use client";

import { useState } from "react";

const SUBJECTS = [
  "General enquiry",
  "Order status",
  "Returns & exchanges",
  "Sizing advice",
  "Wholesale",
  "Press",
];

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("loading");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState("error");
        setFeedback(payload.error ?? "Something went wrong.");
        return;
      }
      setState("done");
      setFeedback(payload.message ?? "Message sent.");
      setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" });
    } catch {
      setState("error");
      setFeedback("Network error. Try again.");
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="ui-sm text-muted">Name</span>
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="field mt-1"
            autoComplete="name"
          />
        </label>
        <label>
          <span className="ui-sm text-muted">Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="field mt-1"
            autoComplete="email"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="ui-sm text-muted">Subject</span>
        <select
          value={form.subject}
          onChange={(event) => setForm({ ...form, subject: event.target.value })}
          className="field mt-1"
        >
          {SUBJECTS.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="ui-sm text-muted">Message</span>
        <textarea
          required
          rows={6}
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          className="field mt-1"
        />
      </label>

      <button type="submit" disabled={state === "loading"} className="btn btn--solid mt-3">
        {state === "loading" ? "Sending" : "Send message"}
      </button>

      {feedback ? <p className="ui-sm mt-2">{feedback}</p> : null}
    </form>
  );
}
