# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevPet is a landing page for a product that helps people learn "vibe coding" (AI-assisted coding) through an AI pet companion. The landing page collects waitlist signups and supports English/Vietnamese bilingual content.

## Commands

All commands run from the `landing/` directory:

```bash
cd landing
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

There are no tests configured yet.

## Architecture

The app lives entirely in the `landing/` subdirectory — a Next.js 16 app using React 19, TypeScript, and Tailwind CSS v4.

### Key Patterns

- **Styling approach**: Components use inline `style={{}}` objects rather than Tailwind utility classes (established in commit 365d051). Follow this pattern.
- **Bilingual i18n**: Client-side language switching via React Context (`src/i18n/`). `LanguageContext.tsx` provides `useLanguage()` hook. All user-facing strings live in `translations.ts` keyed by `"en" | "vi"`. Always add both languages when adding text.
- **Component structure**: Section-based components in `src/components/` (Hero, Features, Problem, HowItWorks, Audience, SocialProof, CtaSection, Footer, Navbar). Each renders one landing page section.
- **Reveal animation**: `Reveal.tsx` is an IntersectionObserver-based fade-in wrapper used throughout sections.
- **Waitlist API**: `src/app/api/waitlist/route.ts` — currently logs emails to console. Resend integration is stubbed but not active (needs `RESEND_API_KEY` env var).
- **Analytics**: Plausible analytics script in `layout.tsx` (domain: devpet.com).

### File Layout

```
landing/
  src/
    app/
      page.tsx          # Main landing page (assembles all sections)
      layout.tsx        # Root layout with metadata + analytics
      globals.css       # Global styles
      api/waitlist/     # Waitlist signup endpoint
    components/         # One component per landing page section
    i18n/               # Language context + translation strings
```
