"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Reveal from "./Reveal";

export default function HowItWorks() {
  const { t } = useLanguage();

  return (
    <section id="how" className="px-8 pt-[60px] pb-20 max-w-[660px] mx-auto">
      <Reveal>
        <div className="text-center mb-10">
          <span className="text-[9px] font-mono text-accent tracking-[0.14em] uppercase font-semibold">
            {t.how.label}
          </span>
          <h2 className="text-[34px] font-display font-semibold leading-[1.2] mt-2.5">
            {t.how.h2a}
            <br />
            {t.how.h2b}
          </h2>
        </div>
      </Reveal>

      {t.how.steps.map((step, i) => (
        <Reveal key={i} delay={i * 0.08}>
          <div
            className={`flex gap-5 py-7 ${
              i < t.how.steps.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="w-11 h-11 rounded-xl shrink-0 bg-card border border-border flex items-center justify-center text-xl">
              {step.icon}
            </div>
            <div>
              <div className="text-[10px] font-mono text-accent font-semibold mb-1.5">
                Step {step.step}
              </div>
              <h3 className="text-[17px] font-display font-semibold">
                {step.title}
              </h3>
              <p className="text-[12.5px] text-muted leading-[1.65] mt-1.5">
                {step.body}
              </p>
            </div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
