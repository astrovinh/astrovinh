"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import WaitlistForm from "./WaitlistForm";
import Reveal from "./Reveal";

interface CtaSectionProps {
  count: number;
  onSubmit: () => void;
}

export default function CtaSection({ count, onSubmit }: CtaSectionProps) {
  const { t } = useLanguage();

  return (
    <section id="cta" style={{ padding: "60px 32px 100px", textAlign: "center" }}>
      <Reveal>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ fontSize: 52, marginBottom: 14, animation: "catWave 2s ease infinite" }}>😺</div>
          <h2 style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15 }}>
            {t.cta.h2a}<br /><span style={{ fontStyle: "italic", color: "var(--accent)" }}>{t.cta.h2b}</span>
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginTop: 12 }}>
            {count.toLocaleString()} {t.cta.sub}
          </p>
          <div style={{ marginTop: 24 }}>
            <WaitlistForm
              onSubmit={onSubmit}
              successEmoji="😸"
              successMessage={t.cta.success}
              successSub={t.cta.successSub}
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
