"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "./LanguageToggle";

export default function Navbar() {
  const { t } = useLanguage();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-3.5 flex justify-between items-center bg-gradient-to-b from-background via-background/70 to-transparent backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-[22px]">😺</span>
        <span className="text-[15px] font-display font-semibold">DevPet</span>
      </div>
      <div className="flex items-center gap-5">
        <a
          href="#features"
          className="text-[11px] text-muted no-underline font-mono transition-colors duration-200 hover:text-foreground"
        >
          {t.nav.features}
        </a>
        <a
          href="#how"
          className="text-[11px] text-muted no-underline font-mono transition-colors duration-200 hover:text-foreground"
        >
          {t.nav.how}
        </a>
        <LanguageToggle />
        <a
          href="#cta"
          className="text-[11px] font-mono font-semibold text-white bg-accent px-4 py-[7px] rounded-lg no-underline transition-all duration-150 hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(216,152,64,0.25)]"
        >
          {t.nav.join}
        </a>
      </div>
    </nav>
  );
}
