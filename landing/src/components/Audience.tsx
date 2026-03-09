"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function Audience() {
  const { t } = useLanguage();

  return (
    <section style={{ padding: "40px 32px 60px", maxWidth: 660, margin: "0 auto" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 9, fontFamily: "var(--m)", color: "var(--accent)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{t.audience.label}</span>
          <h2 style={{ fontSize: 26, fontFamily: "var(--d)", fontWeight: 600, lineHeight: 1.3, marginTop: 10 }}>{t.audience.h2a}<br />{t.audience.h2b}</h2>
        </div>
      </Reveal>
      {t.audience.items.map((p, i) => (
        <Reveal key={i} delay={i * 0.06}>
          <div style={{ display: "flex", gap: 14, padding: "16px 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{p.icon}</span>
            <div>
              <h3 style={{ fontSize: 13, fontFamily: "var(--d)", fontWeight: 600 }}>{p.who}</h3>
              <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, marginTop: 3 }}>{p.desc}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
