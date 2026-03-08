"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function Features() {
  const { t } = useLanguage();

  return (
    <section id="features" className="px-8 pt-[60px] pb-20 max-w-[860px] mx-auto">
      <Reveal>
        <div className="text-center mb-10">
          <span className="text-[9px] font-mono text-accent tracking-[0.14em] uppercase font-semibold">
            {t.features.label}
          </span>
          <h2 className="text-[34px] font-display font-semibold leading-[1.2] mt-2.5">
            {t.features.h2a}
            <br />
            <span className="italic text-accent">{t.features.h2b}</span>
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3.5">
        {t.features.items.map((feature, i) => (
          <Reveal key={i} delay={i * 0.05}>
            <div className="bg-card border border-border rounded-2xl px-5 py-[22px] transition-all duration-200 hover:border-accent/25 hover:-translate-y-0.5">
              <div className="flex justify-between">
                <span className="text-[26px]">{feature.icon}</span>
                <span className="text-[9px] font-mono text-accent bg-accent-light px-2 py-[3px] rounded-[5px] font-semibold h-fit">
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-sm font-display font-semibold mt-3">
                {feature.title}
              </h3>
              <p className="text-[11.5px] text-muted leading-[1.65] mt-1.5">
                {feature.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
