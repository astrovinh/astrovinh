"use client";

import { useLanguage } from "@/i18n/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border px-8 py-7 text-center">
      <div className="flex justify-center items-center gap-2 mb-2.5">
        <span className="text-base">😺</span>
        <span className="text-[13px] font-display font-semibold">DevPet</span>
      </div>
      <p className="text-[10px] font-mono text-muted">{t.footer.tagline}</p>
      <p className="text-[9px] font-mono text-muted-light mt-1.5">
        {t.footer.copy}
      </p>
    </footer>
  );
}
