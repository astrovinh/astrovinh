"use client";

import { useLanguage } from "@/i18n/LanguageContext";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex rounded-lg border border-border overflow-hidden bg-card">
      {(["en", "vi"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-[10px] font-mono font-semibold uppercase cursor-pointer transition-all duration-150 border-none ${
            lang === l
              ? "bg-foreground text-white"
              : "bg-transparent text-muted hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
