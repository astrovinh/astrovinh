"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function Problem() {
  const { t } = useLanguage();

  return (
    <section style={{ padding: "80px 32px", maxWidth: 800, margin: "0 auto" }}>
      <Reveal>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 9, fontFamily: "var(--m)", color: "#D89840", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{t.problem.label}</span>
          <h2 style={{ fontSize: 34, fontFamily: "var(--d)", fontWeight: 600, lineHeight: 1.2, marginTop: 10 }}>{t.problem.h2a}<br /><span style={{ color: "var(--muted)" }}>{t.problem.h2b}</span></h2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 40 }}>
        {t.problem.items.map((p, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 18px" }}>
              <span style={{ fontSize: 26 }}>{p.emoji}</span>
              <h3 style={{ fontSize: 13, fontFamily: "var(--d)", fontWeight: 600, marginTop: 10 }}>{p.title}</h3>
              <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginTop: 6 }}>{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
