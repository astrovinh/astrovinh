"use client";

import { useLanguage } from "@/i18n/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "28px 32px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>😺</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>DevPet</span>
      </div>
      <p style={{ fontSize: 10, color: "var(--muted)" }}>{t.footer.tagline}</p>
      <p style={{ fontSize: 9, color: "#C8C0B4", marginTop: 6 }}>{t.footer.copy}</p>
    </footer>
  );
}
