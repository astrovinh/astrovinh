"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import WaitlistForm from "./WaitlistForm";
import Reveal from "./Reveal";

interface CtaSectionProps {
  count: number;
}

export default function CtaSection({ count }: CtaSectionProps) {
  const { t } = useLanguage();

  return (
    <section id="cta" className="px-8 pt-[60px] pb-[100px] text-center">
      <Reveal>
        <div className="max-w-[520px] mx-auto">
          {/* Cat with wave animation */}
          <div className="text-[52px] mb-3.5 animate-[catWave_2s_ease_infinite]">
            😺
          </div>

          <h2 className="text-[34px] font-display font-bold leading-[1.15]">
            {t.cta.h2a}
            <br />
            <span className="italic text-accent">{t.cta.h2b}</span>
          </h2>

          <p className="text-[13px] text-muted leading-[1.6] mt-3">
            {count.toLocaleString()} {t.cta.sub}
          </p>

          <div className="mt-6">
            <WaitlistForm
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
