"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function HowItWorks() {
  const { t } = useLanguage();

  return (
    <section id="how" style={{ padding: "60px 32px 80px", maxWidth: 660, margin: "0 auto" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 9, fontFamily: "var(--m)", color: "#D89840", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{t.how.label}</span>
          <h2 style={{ fontSize: 34, fontFamily: "var(--d)", fontWeight: 600, lineHeight: 1.2, marginTop: 10 }}>{t.how.h2a}<br />{t.how.h2b}</h2>
        </div>
      </Reveal>
      {t.how.steps.map((s, i) => (
        <Reveal key={i} delay={i * 0.08}>
          <div style={{ display: "flex", gap: 20, padding: "28px 0", borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "var(--card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontFamily: "var(--m)", color: "var(--accent)", fontWeight: 600, marginBottom: 5 }}>Step {s.step}</div>
              <h3 style={{ fontSize: 17, fontFamily: "var(--d)", fontWeight: 600 }}>{s.title}</h3>
              <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.65, marginTop: 6 }}>{s.body}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
