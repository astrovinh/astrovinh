"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import WaitlistForm from "./WaitlistForm";

interface HeroProps {
  count: number;
}

export default function Hero({ count }: HeroProps) {
  const { t } = useLanguage();

  return (
    <section className="min-h-screen flex flex-col justify-center items-center px-8 pt-[120px] pb-20 text-center relative">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full bg-[radial-gradient(ellipse,rgba(216,152,64,0.07)_0%,transparent_70%)]" />

      <div className="relative z-10 max-w-[660px]">
        {/* Cat emoji */}
        <div className="text-[60px] mb-5 animate-[float_3s_ease_infinite,fadeUp_0.8s_ease]">
          😺
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-card border border-border rounded-full px-3.5 py-1.5 mb-[22px] animate-[fadeUp_0.8s_ease_0.1s_both]">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-[pulse_2s_infinite]" />
          <span className="text-[11px] font-mono text-accent font-medium">
            {t.badge}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-[52px] font-display font-bold leading-[1.1] tracking-[-0.03em] animate-[fadeUp_0.8s_ease_0.15s_both]">
          {t.hero.h1a}
          <br />
          <span className="italic text-accent">{t.hero.h1b}</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base text-muted leading-[1.7] mt-[18px] max-w-[500px] mx-auto animate-[fadeUp_0.8s_ease_0.25s_both]">
          {t.hero.sub}
        </p>

        {/* Waitlist form */}
        <div className="mt-7 animate-[fadeUp_0.8s_ease_0.35s_both]">
          <WaitlistForm />
          <p className="text-[10px] text-muted-light mt-2.5 font-mono">
            {count.toLocaleString()} {t.waitlist.count}
          </p>
        </div>
      </div>
    </section>
  );
}
