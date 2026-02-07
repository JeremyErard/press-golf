import {
  HeroSection,
  FeaturesSection,
  HowItWorksSection,
  AppPreviewSection,
  GamesShowcaseSection,
  CtaSection,
  Footer,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <GamesShowcaseSection />
      <AppPreviewSection />
      <CtaSection />
      <Footer />
    </main>
  );
}
