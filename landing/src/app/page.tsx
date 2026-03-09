"use client";

import { useState } from "react";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import SocialProof from "@/components/SocialProof";
import Audience from "@/components/Audience";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

export default function Home() {
  const [count, setCount] = useState(847);

  const onWaitlistSubmit = () => setCount((c) => c + 1);

  return (
    <LanguageProvider>
      <div style={{ fontFamily: "var(--b)", background: "#FBF9F1", color: "#2D2B26", minHeight: "100vh" }}>
        <Navbar />
        <Hero count={count} onSubmit={onWaitlistSubmit} />
        <Problem />
        <Features />
        <HowItWorks />
        <SocialProof />
        <Audience />
        <CtaSection count={count} onSubmit={onWaitlistSubmit} />
        <Footer />
      </div>
    </LanguageProvider>
  );
}
