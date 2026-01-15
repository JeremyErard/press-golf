"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Layers, Target, Calculator, ChevronRight } from "lucide-react";

interface FirstLaunchExplainerProps {
  onComplete: () => void;
}

const screens = [
  {
    icon: null, // Logo screen
    title: "Welcome to Press",
    subtitle: "Your golf bets, handled.",
    description: "Track games, keep score, settle up — no more arguing about who owes what.",
    cta: "Get Started",
  },
  {
    icon: Layers,
    title: "Pick Your Game",
    subtitle: "Nassau, Skins, Wolf, and more.",
    description: "Don't know the rules? We explain each one when you set up your round.",
    cta: "Next",
  },
  {
    icon: Target,
    title: "Live Scoring",
    subtitle: "Enter scores as you play.",
    description: "See who's winning in real-time. Everyone in the group sees the same live updates.",
    cta: "Next",
  },
  {
    icon: Calculator,
    title: "Settle Up Instantly",
    subtitle: "When the round ends, Press calculates who owes who.",
    description: "No math. No arguments. Just golf.",
    cta: "Let's Go",
  },
];

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
  const Icon = screen.icon;
  const isLastScreen = currentScreen === screens.length - 1;
  const isFirstScreen = currentScreen === 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0f14] flex flex-col">
      {/* Skip button - always visible except on last screen */}
      {!isLastScreen && (
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={handleSkip}
            className="text-white/50 hover:text-white/80 text-sm font-medium transition-colors"
          >
            Skip
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
        {/* Icon or Logo */}
        <div className="mb-8">
          {isFirstScreen ? (
            <div className="text-center">
              <h1 className="text-5xl font-black tracking-tight text-white mb-2">
                PRESS
              </h1>
              <p className="text-white/40 text-xs uppercase tracking-[0.2em]">
                Your Side Games Managed For You
              </p>
            </div>
          ) : Icon ? (
            <div className="w-20 h-20 rounded-2xl bg-brand/20 flex items-center justify-center">
              <Icon className="w-10 h-10 text-brand" />
            </div>
          ) : null}
        </div>

        {/* Text content */}
        {!isFirstScreen && (
          <h2 className="text-3xl font-bold text-white text-center mb-3">
            {screen.title}
          </h2>
        )}

        <p className="text-xl text-white/80 text-center mb-4 max-w-xs">
          {isFirstScreen ? screen.subtitle : screen.subtitle}
        </p>

        <p className="text-base text-white/50 text-center max-w-sm leading-relaxed">
          {screen.description}
        </p>
      </div>

      {/* Bottom section */}
      <div className="absolute bottom-0 left-0 right-0 px-8 pb-12">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {screens.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentScreen
                  ? "w-8 bg-brand"
                  : index < currentScreen
                  ? "w-2 bg-brand/50"
                  : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleNext}
          className="w-full h-14 text-base font-semibold bg-brand hover:bg-brand-dark"
          size="lg"
        >
          {screen.cta}
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
