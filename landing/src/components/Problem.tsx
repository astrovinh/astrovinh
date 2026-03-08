"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function Problem() {
  const { t } = useLanguage();

  return (
    <section className="px-8 py-20 max-w-[800px] mx-auto">
      <Reveal>
        <div className="text-center">
          <span className="text-[9px] font-mono text-accent tracking-[0.14em] uppercase font-semibold">
            {t.problem.label}
          </span>
          <h2 className="text-[34px] font-display font-semibold leading-[1.2] mt-2.5">
            {t.problem.h2a}
            <br />
            <span className="text-muted">{t.problem.h2b}</span>
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-3 gap-3.5 mt-10">
        {t.problem.items.map((item, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <div className="bg-card border border-border rounded-2xl px-[18px] py-[22px]">
              <span className="text-[26px]">{item.emoji}</span>
              <h3 className="text-[13px] font-display font-semibold mt-2.5">
                {item.title}
              </h3>
              <p className="text-[11.5px] text-muted leading-[1.6] mt-1.5">
                {item.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
