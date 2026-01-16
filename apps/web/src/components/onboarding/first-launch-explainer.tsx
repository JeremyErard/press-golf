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
    mockup: null,
  },
  {
    backgroundImage: "/images/golf-daybreak.jpg",
    title: "Pick Your Game",
    subtitle: "Nassau, Skins, Wolf, and more.",
    description: "Don't know the rules? We explain each one when you set up your round.",
    cta: "Next",
    mockup: "games",
  },
  {
    backgroundImage: "/images/golf-afternoon.jpg",
    title: "Live Scoring",
    subtitle: "Enter scores as you play.",
    description: "See who's winning in real-time. Everyone in the group sees the same live updates.",
    cta: "Next",
    mockup: "scorecard",
  },
  {
    backgroundImage: "/images/golf-trophy.jpg",
    title: "Settle Up Instantly",
    subtitle: "No math. No arguments.",
    description: "When the round ends, Press calculates who owes who. Just tap to pay.",
    cta: "Let's Go",
    mockup: "settlement",
  },
];

// Stylized phone mockup component showing game types
function GamesMockup() {
  const games = [
    { name: "Nassau", amount: "$10", color: "bg-brand" },
    { name: "Skins", amount: "$5", color: "bg-amber-500" },
    { name: "Match Play", amount: "$20", color: "bg-purple-500" },
  ];

  return (
    <div className="relative w-48 mx-auto">
      {/* Phone frame */}
      <div className="bg-black/80 rounded-[2rem] p-2 shadow-2xl border border-white/20">
        <div className="bg-[#0a0f14] rounded-[1.5rem] overflow-hidden">
          {/* Status bar mock */}
          <div className="h-6 bg-black/50 flex items-center justify-center">
            <div className="w-16 h-4 bg-black rounded-full" />
          </div>
          {/* Content */}
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Select Games</p>
            {games.map((game, i) => (
              <div
                key={game.name}
                className={`flex items-center justify-between p-2 rounded-lg ${game.color}/20 border border-white/10`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <span className="text-xs font-medium text-white">{game.name}</span>
                <span className={`text-xs font-bold ${game.color === 'bg-brand' ? 'text-brand' : game.color === 'bg-amber-500' ? 'text-amber-500' : 'text-purple-500'}`}>
                  {game.amount}
                </span>
              </div>
            ))}
            <div className="pt-2">
              <div className="h-8 bg-brand rounded-lg flex items-center justify-center">
                <span className="text-xs font-semibold text-white">Start Round</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stylized scorecard mockup
function ScorecardMockup() {
  const holes = [
    { hole: 1, par: 4, score: 4 },
    { hole: 2, par: 3, score: 3 },
    { hole: 3, par: 5, score: 6 },
    { hole: 4, par: 4, score: 4 },
  ];

  return (
    <div className="relative w-48 mx-auto">
      <div className="bg-black/80 rounded-[2rem] p-2 shadow-2xl border border-white/20">
        <div className="bg-[#0a0f14] rounded-[1.5rem] overflow-hidden">
          <div className="h-6 bg-black/50 flex items-center justify-center">
            <div className="w-16 h-4 bg-black rounded-full" />
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Live Scorecard</p>
              <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
            </div>
            <div className="bg-white/5 rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 gap-px bg-white/10 text-[8px]">
                <div className="bg-[#0a0f14] p-1 text-center text-white/40">Hole</div>
                <div className="bg-[#0a0f14] p-1 text-center text-white/40">Par</div>
                <div className="bg-[#0a0f14] p-1 text-center text-white/40">You</div>
                <div className="bg-[#0a0f14] p-1 text-center text-white/40">+/-</div>
                {holes.map((h) => [
                    <div key={`hole-${h.hole}`} className="bg-[#0a0f14] p-1 text-center text-white font-medium">{h.hole}</div>,
                    <div key={`par-${h.hole}`} className="bg-[#0a0f14] p-1 text-center text-white/60">{h.par}</div>,
                    <div key={`score-${h.hole}`} className="bg-[#0a0f14] p-1 text-center text-white font-bold">{h.score}</div>,
                    <div key={`diff-${h.hole}`} className={`bg-[#0a0f14] p-1 text-center font-medium ${h.score < h.par ? 'text-brand' : h.score > h.par ? 'text-error' : 'text-white/40'}`}>
                      {h.score - h.par === 0 ? 'E' : h.score - h.par > 0 ? `+${h.score - h.par}` : h.score - h.par}
                    </div>,
                ])}
              </div>
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-white/60">Nassau $10</span>
              <span className="text-[10px] font-semibold text-brand">1 UP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stylized settlement mockup
function SettlementMockup() {
  return (
    <div className="relative w-48 mx-auto">
      <div className="bg-black/80 rounded-[2rem] p-2 shadow-2xl border border-white/20">
        <div className="bg-[#0a0f14] rounded-[1.5rem] overflow-hidden">
          <div className="h-6 bg-black/50 flex items-center justify-center">
            <div className="w-16 h-4 bg-black rounded-full" />
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Settlement</p>
            {/* Net position */}
            <div className="bg-brand/20 border border-brand/30 rounded-lg p-3 text-center">
              <p className="text-[10px] text-white/60 mb-1">Your Net Position</p>
              <p className="text-2xl font-bold text-brand">+$45</p>
            </div>
            {/* Settlements list */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[8px] font-bold text-white">M</div>
                  <span className="text-[10px] text-white">Mike</span>
                </div>
                <span className="text-[10px] font-semibold text-brand">+$25</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[8px] font-bold text-white">S</div>
                  <span className="text-[10px] text-white">Sarah</span>
                </div>
                <span className="text-[10px] font-semibold text-brand">+$20</span>
              </div>
            </div>
            <div className="h-7 bg-brand rounded-lg flex items-center justify-center">
              <span className="text-[10px] font-semibold text-white">Collect via Venmo</span>
            </div>
          </div>
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
    <div className="fixed inset-0 z-[100] bg-black">
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
        <div className="flex-1 flex items-center justify-center pt-16 pb-8">
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
          ) : screen.mockup === "games" ? (
            <GamesMockup />
          ) : screen.mockup === "scorecard" ? (
            <ScorecardMockup />
          ) : screen.mockup === "settlement" ? (
            <SettlementMockup />
          ) : null}
        </div>

        {/* Bottom section - Text and CTA */}
        <div className="px-8 pb-12">
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
