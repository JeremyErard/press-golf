"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { ChevronRight, Flag } from "lucide-react";
import Image from "next/image";

interface FirstLaunchExplainerProps {
  onComplete: () => void;
}

const screens = [
  {
    backgroundImage: "/images/golf-hero.jpg",
    title: "Welcome to Press",
    subtitle: "Your golf bets, handled.",
    description: "Track games, keep score, settle up — no more arguing about who owes what.",
    cta: "Get Started",
    screenshot: null,
  },
  {
    backgroundImage: "/images/golf-daybreak.jpg",
    title: "Set Up Your Profile",
    subtitle: "Get ready to play.",
    description: "Add your handicap and connect your payment app so you're ready to settle up.",
    cta: "Next",
    screenshot: "/images/Screenshot 2026-01-16 at 5.10.07 PM.png",
  },
  {
    backgroundImage: "/images/golf-afternoon.jpg",
    title: "Start a Round",
    subtitle: "Nassau, Skins, Wolf, and more.",
    description: "Start a round, invite your buddies, then pick your games. We'll explain the rules and help you set up bet amounts.",
    cta: "Next",
    screenshot: "/images/Screenshot 2026-01-16 at 5.09.15 PM.png",
  },
  {
    backgroundImage: "/images/golf-hero.jpg",
    title: "Live Scoring",
    subtitle: "Track every hole.",
    description: "Enter scores hole-by-hole. We track who's up, who's down, and what's at stake.",
    cta: "Next",
    screenshot: "/images/Screenshot 2026-01-16 at 5.08.31 PM.png",
  },
  {
    backgroundImage: "/images/golf-trophy.jpg",
    title: "Settle Up",
    subtitle: "No math. No arguments.",
    description: "When you finish, we show exactly who owes who. Tap to settle instantly.",
    cta: "Let's Go",
    screenshot: "/images/Screenshot 2026-01-16 at 5.07.08 PM.png",
  },
];

// Phone mockup component that displays an actual screenshot
function ScreenshotMockup({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-64 sm:w-72 mx-auto">
      {/* Phone frame */}
      <div className="bg-black/80 rounded-[2.5rem] p-2 shadow-2xl border border-white/20">
        <div className="rounded-[2rem] overflow-hidden relative bg-black" style={{ aspectRatio: '9/19.5' }}>
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            sizes="288px"
          />
        </div>
      </div>
    </div>
  );
}

export function FirstLaunchExplainer({ onComplete }: FirstLaunchExplainerProps) {
  const [currentScreen, setCurrentScreen] = useState(0);

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const screen = screens[currentScreen];
  const isLastScreen = currentScreen === screens.length - 1;
  const isFirstScreen = currentScreen === 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black" style={{ minHeight: '100dvh' }}>
      {/* Background image with gradient overlay */}
      <div className="absolute inset-0">
        <Image
          src={screen.backgroundImage}
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
      </div>

      {/* Skip button */}
      {!isLastScreen && (
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={handleSkip}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm"
          >
            Skip
          </button>
        </div>
      )}

      {/* Content */}
      <div className="relative h-full flex flex-col">
        {/* Top section - Mockup or Logo */}
        <div className={`flex-1 flex items-center justify-center pt-12 ${isFirstScreen ? 'pb-8' : 'pb-0'}`}>
          {isFirstScreen ? (
            <div className="text-center animate-fade-in">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-brand/20 backdrop-blur-sm border border-brand/30 flex items-center justify-center">
                <Flag className="w-12 h-12 text-brand" />
              </div>
              <h1 className="text-5xl font-black tracking-tight text-white mb-2 drop-shadow-lg">
                PRESS
              </h1>
              <p className="text-white/60 text-sm uppercase tracking-[0.2em]">
                Your Side Games Managed For You
              </p>
            </div>
          ) : screen.screenshot ? (
            <ScreenshotMockup src={screen.screenshot} alt={screen.title} />
          ) : null}
        </div>

        {/* Bottom section - Text and CTA - overlaps phone bezel on screenshot screens */}
        <div className={`px-8 relative z-10 ${!isFirstScreen ? '-mt-36' : ''}`} style={{ paddingBottom: 'calc(3rem + env(safe-area-inset-bottom, 0px))' }}>
          {/* Text content */}
          <div className="text-center mb-8">
            {!isFirstScreen && (
              <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-lg">
                {screen.title}
              </h2>
            )}
            <p className="text-xl text-white/90 mb-3 drop-shadow-md">
              {screen.subtitle}
            </p>
            <p className="text-base text-white/60 max-w-sm mx-auto leading-relaxed">
              {screen.description}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {screens.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentScreen
                    ? "w-8 bg-brand"
                    : index < currentScreen
                    ? "w-2 bg-brand/50"
                    : "w-2 bg-white/30"
                }`}
              />
            ))}
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleNext}
            className="w-full h-14 text-base font-semibold bg-brand hover:bg-brand-dark shadow-lg shadow-brand/30"
            size="lg"
          >
            {screen.cta}
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
