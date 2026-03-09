"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function SocialProof() {
  const { t } = useLanguage();

  return (
    <section style={{ padding: "40px 32px 60px", maxWidth: 760, margin: "0 auto" }}>
      <Reveal>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "36px 32px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 36, marginBottom: 28, flexWrap: "wrap" as const }}>
            {t.social.stats.map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 26, fontFamily: "var(--m)", fontWeight: 700, color: "var(--accent)" }}>{s.value}</div>
                <div style={{ fontSize: 10, fontFamily: "var(--m)", color: "var(--muted)", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 15, fontFamily: "var(--d)", fontStyle: "italic", color: "#777", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>&ldquo;{t.social.quote}&rdquo;</p>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)" }}>— {t.social.author}</div>
        </div>
      </Reveal>
    </section>
  );
}
