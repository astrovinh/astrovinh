"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "./LanguageToggle";

export default function Navbar() {
  const { t } = useLanguage();

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(180deg, #FBF9F1 70%, transparent)", backdropFilter: "blur(8px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22 }}>😺</span>
        <span style={{ fontSize: 15, fontFamily: "var(--d)", fontWeight: 600 }}>DevPet</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <a href="#features" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none", fontFamily: "var(--m)", transition: "color 0.2s" }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = "var(--text)")}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = "var(--muted)")}>{t.nav.features}</a>
        <a href="#how" style={{ fontSize: 11, color: "var(--muted)", textDecoration: "none", fontFamily: "var(--m)", transition: "color 0.2s" }}
          onMouseEnter={e => ((e.target as HTMLElement).style.color = "var(--text)")}
          onMouseLeave={e => ((e.target as HTMLElement).style.color = "var(--muted)")}>{t.nav.how}</a>
        <LanguageToggle />
        <a href="#cta" style={{ fontSize: 11, fontFamily: "var(--m)", fontWeight: 600, color: "#fff", background: "var(--accent)", padding: "7px 16px", borderRadius: 8, textDecoration: "none", transition: "transform 0.15s, box-shadow 0.15s" }}
          onMouseEnter={e => { (e.target as HTMLElement).style.transform = "translateY(-1px)"; (e.target as HTMLElement).style.boxShadow = "0 4px 14px rgba(216,152,64,0.25)"; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.transform = ""; (e.target as HTMLElement).style.boxShadow = ""; }}>
          {t.nav.join}
        </a>
      </div>
    </nav>
  );
}
