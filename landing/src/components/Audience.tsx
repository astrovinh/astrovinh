"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function Audience() {
  const { t } = useLanguage();

  return (
    <section className="px-8 pt-10 pb-[60px] max-w-[660px] mx-auto">
      <Reveal>
        <div className="text-center mb-7">
          <span className="text-[9px] font-mono text-accent tracking-[0.14em] uppercase font-semibold">
            {t.audience.label}
          </span>
          <h2 className="text-[26px] font-display font-semibold leading-[1.3] mt-2.5">
            {t.audience.h2a}
            <br />
            {t.audience.h2b}
          </h2>
        </div>
      </Reveal>

      {t.audience.items.map((item, i) => (
        <Reveal key={i} delay={i * 0.06}>
          <div className="flex gap-3.5 px-[18px] py-4 bg-card border border-border rounded-[14px] mb-2 items-center">
            <span className="text-[26px] shrink-0">{item.icon}</span>
            <div>
              <h3 className="text-[13px] font-display font-semibold">
                {item.who}
              </h3>
              <p className="text-[11.5px] text-muted leading-[1.5] mt-[3px]">
                {item.desc}
              </p>
            </div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
