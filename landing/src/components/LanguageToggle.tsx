"use client";

import { useLanguage } from "@/i18n/LanguageContext";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div style={{ display: "flex", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      {(["en", "vi"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            background: lang === l ? "var(--text)" : "transparent",
            color: lang === l ? "#fff" : "var(--muted)",
            border: "none",
            padding: "5px 10px",
            fontSize: 10,
            fontFamily: "var(--m)",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
            textTransform: "uppercase",
          }}
        >
          {l === "en" ? "EN" : "VI"}
        </button>
      ))}
    </div>
  );
}
