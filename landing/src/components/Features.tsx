"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function Features() {
  const { t } = useLanguage();

  return (
    <section id="features" style={{ padding: "60px 32px 80px", maxWidth: 860, margin: "0 auto" }}>
      <Reveal>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{t.features.label}</span>
          <h2 style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.2, marginTop: 10 }}>{t.features.h2a}<br /><span style={{ fontStyle: "italic", color: "var(--accent)" }}>{t.features.h2b}</span></h2>
        </div>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {t.features.items.map((f, i) => (
          <Reveal key={i} delay={i * 0.05}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 20px", transition: "border-color 0.2s, transform 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#D8984044"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = ""; }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 26 }}>{f.icon}</span>
                <span style={{ fontSize: 9, color: "var(--accent)", background: "var(--accent-light)", padding: "3px 8px", borderRadius: 5, fontWeight: 600, height: "fit-content" }}>{f.tag}</span>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 12 }}>{f.title}</h3>
              <p style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.65, marginTop: 6 }}>{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
