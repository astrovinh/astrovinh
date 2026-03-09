"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import WaitlistForm from "./WaitlistForm";

interface HeroProps {
  count: number;
  onSubmit: () => void;
}

export default function Hero({ count, onSubmit }: HeroProps) {
  const { t } = useLanguage();

  return (
    <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "120px 32px 80px", textAlign: "center", position: "relative" }}>
      <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translateX(-50%)", width: 500, height: 350, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(216,152,64,0.07) 0%, transparent 70%)" }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 660 }}>
        <div style={{ fontSize: 60, marginBottom: 20, animation: "float 3s ease infinite, fadeUp 0.8s ease" }}>😺</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "6px 14px", marginBottom: 22, animation: "fadeUp 0.8s ease 0.1s both" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, fontFamily: "var(--m)", color: "var(--accent)", fontWeight: 500 }}>{t.badge}</span>
        </div>
        <h1 style={{ fontSize: 52, fontFamily: "var(--d)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", animation: "fadeUp 0.8s ease 0.15s both" }}>
          {t.hero.h1a}<br /><span style={{ fontStyle: "italic", color: "var(--accent)" }}>{t.hero.h1b}</span>
        </h1>
        <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, marginTop: 18, maxWidth: 500, marginLeft: "auto", marginRight: "auto", animation: "fadeUp 0.8s ease 0.25s both" }}>{t.hero.sub}</p>
        <div style={{ marginTop: 28, animation: "fadeUp 0.8s ease 0.35s both" }}>
          <WaitlistForm onSubmit={onSubmit} />
          <p style={{ fontSize: 10, color: "#C8C0B4", marginTop: 10, fontFamily: "var(--m)" }}>{count.toLocaleString()} {t.waitlist.count}</p>
        </div>
      </div>
    </section>
  );
}
