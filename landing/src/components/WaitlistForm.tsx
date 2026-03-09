"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

interface WaitlistFormProps {
  onSubmit?: () => void;
  successEmoji?: string;
  successMessage?: string;
  successSub?: string;
}

export default function WaitlistForm({
  onSubmit,
  successEmoji = "😸",
  successMessage,
  successSub,
}: WaitlistFormProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes("@")) return;

    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Silently handle — still show success for UX
    }

    setSubmitted(true);
    onSubmit?.();
  };

  if (submitted) {
    return (
      <div style={{ animation: "scaleIn 0.4s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 32 }}>{successEmoji}</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>
          {successMessage || t.waitlist.success}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {successSub || t.waitlist.successSub}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto", background: "var(--card)", borderRadius: 14, padding: 5, border: "1px solid var(--border)" }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder={t.waitlist.placeholder}
        style={{ flex: 1, background: "transparent", border: "none", color: "var(--text)", fontSize: 13, padding: "11px 12px", outline: "none" }}
      />
      <button
        onClick={handleSubmit}
        style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "transform 0.15s", flexShrink: 0 }}
        onMouseEnter={e => ((e.target as HTMLElement).style.transform = "translateY(-1px)")}
        onMouseLeave={e => ((e.target as HTMLElement).style.transform = "")}
      >
        {t.waitlist.btn}
      </button>
    </div>
  );
}
