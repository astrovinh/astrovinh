"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

interface WaitlistFormProps {
  successEmoji?: string;
  successMessage?: string;
  successSub?: string;
}

export default function WaitlistForm({
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
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-1.5 animate-[scaleIn_0.4s_ease]">
        <span className="text-[32px]">{successEmoji}</span>
        <span className="text-[15px] font-display font-semibold text-accent">
          {successMessage || t.waitlist.success}
        </span>
        <span className="text-xs text-muted">
          {successSub || t.waitlist.successSub}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 max-w-[420px] mx-auto bg-card rounded-[14px] p-[5px] border border-border">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder={t.waitlist.placeholder}
        className="flex-1 bg-transparent border-none text-foreground text-[13px] font-body px-3 py-[11px] outline-none"
      />
      <button
        onClick={handleSubmit}
        className="bg-accent text-white border-none rounded-[10px] px-[22px] py-[11px] text-xs font-display font-semibold cursor-pointer transition-transform duration-150 shrink-0 hover:-translate-y-px"
      >
        {t.waitlist.btn}
      </button>
    </div>
  );
}
