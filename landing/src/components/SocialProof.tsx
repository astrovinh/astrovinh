"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function SocialProof() {
  const { t } = useLanguage();

  return (
    <section className="px-8 pt-10 pb-[60px] max-w-[760px] mx-auto">
      <Reveal>
        <div className="bg-card border border-border rounded-[20px] px-8 py-9 text-center">
          {/* Stats row */}
          <div className="flex justify-center gap-9 mb-7 flex-wrap">
            {t.social.stats.map((stat, i) => (
              <div key={i}>
                <div className="text-[26px] font-mono font-bold text-accent">
                  {stat.value}
                </div>
                <div className="text-[10px] font-mono text-muted mt-[3px]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Quote */}
          <p className="text-[15px] font-display italic text-[#777] leading-[1.65] max-w-[480px] mx-auto">
            &ldquo;{t.social.quote}&rdquo;
          </p>
          <div className="mt-2.5 text-[11px] text-muted">
            — {t.social.author}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
