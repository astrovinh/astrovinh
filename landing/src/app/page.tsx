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
  const [count] = useState(847);

  return (
    <LanguageProvider>
      <Navbar />
      <Hero count={count} />
      <Problem />
      <Features />
      <HowItWorks />
      <SocialProof />
      <Audience />
      <CtaSection count={count} />
      <Footer />
    </LanguageProvider>
  );
}
