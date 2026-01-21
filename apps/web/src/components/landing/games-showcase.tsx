"use client";

import {
  Flag,
  CircleDot,
  Swords,
  Dog,
  Grid3X3,
  Star,
  Trophy,
  Dice5,
  Circle,
  Banknote,
  Gamepad2
} from "lucide-react";

const games = [
  {
    name: "Nassau",
    description: "Classic 3-match format: front 9, back 9, and overall",
    icon: Flag,
    color: "text-brand",
    bg: "bg-brand/10",
    popular: true,
  },
  {
    name: "Skins",
    description: "Winner-take-all on each hole. Carryovers add up fast.",
    icon: CircleDot,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    popular: true,
  },
  {
    name: "Match Play",
    description: "Head-to-head scoring. Win the hole, win the point.",
    icon: Swords,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    popular: true,
  },
  {
    name: "Wolf",
    description: "Rotating captain picks partners each hole.",
    icon: Dog,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    popular: true,
  },
  {
    name: "Nines",
    description: "Three points per hole across three 6-hole matches.",
    icon: Grid3X3,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    name: "Stableford",
    description: "Points-based scoring rewards aggressive play.",
    icon: Star,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    name: "Bingo Bango Bongo",
    description: "Three points per hole: first on, closest, first in.",
    icon: Trophy,
    color: "text-brand",
    bg: "bg-brand/10",
  },
  {
    name: "Vegas",
    description: "Team two-digit scoring. Low score goes first.",
    icon: Dice5,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    name: "Snake",
    description: "3-putt and you're holding the snake. Don't be last.",
    icon: Circle,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    name: "Banker",
    description: "Rotating banker takes on the field each hole.",
    icon: Banknote,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
];

export function GamesShowcaseSection() {
  const popularGames = games.filter(g => g.popular);
  const otherGames = games.filter(g => !g.popular);

  return (
    <section className="py-20 px-6 relative">
      {/* Background pattern */}
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute top-20 right-20 w-64 h-64 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
            <Gamepad2 className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium">10 Game Types</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            Every Game You Love
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            From casual Nassau to complex Wolf, Press supports them all with built-in rules and automatic scoring.
          </p>
        </div>

        {/* Popular Games - Large cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {popularGames.map((game, index) => {
            const Icon = game.icon;
            return (
              <div
                key={game.name}
                className="glass-card p-5 rounded-2xl hover:bg-white/5 transition-all duration-300 group animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${game.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-6 h-6 ${game.color}`} />
                  </div>
                  <span className="px-2 py-1 rounded-full bg-brand/20 text-brand text-xs font-medium">Popular</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{game.name}</h3>
                <p className="text-white/60 text-sm">{game.description}</p>
              </div>
            );
          })}
        </div>

        {/* Other Games - Smaller grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {otherGames.map((game, index) => {
            const Icon = game.icon;
            return (
              <div
                key={game.name}
                className="glass-card p-4 rounded-xl hover:bg-white/5 transition-all duration-300 group text-center animate-fade-in-up"
                style={{ animationDelay: `${(index + 4) * 100}ms` }}
              >
                <div className={`w-10 h-10 rounded-lg ${game.bg} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${game.color}`} />
                </div>
                <h3 className="text-white font-semibold text-sm">{game.name}</h3>
              </div>
            );
          })}
        </div>

        {/* Rules callout */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl glass-card">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
              <span className="text-brand text-lg">?</span>
            </div>
            <div className="text-left">
              <p className="text-white font-medium">Don&apos;t know the rules?</p>
              <p className="text-white/60 text-sm">Press explains each game when you set up your round.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
