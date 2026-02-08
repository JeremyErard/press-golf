"use client";

import Image from "next/image";
import {
  Users,
  Radio,
  Dices,
  Calculator,
  CreditCard,
  BadgeCheck,
  Target,
  Trophy,
  TrendingUp,
  Zap,
  Search,
  Swords
} from "lucide-react";

const heroFeatures = [
  {
    title: "10 Game Types",
    description: "Nassau, Skins, Wolf, Match Play, Nines, Stableford, Bingo Bango Bongo, Vegas, Snake, and Banker. All the classics, all in one app.",
    icon: Dices,
    image: "/images/golf-hero.jpg",
    accent: "brand",
    stat: "10",
    statLabel: "Game Types",
  },
  {
    title: "Live Scorecard",
    description: "See who's winning hole by hole. Real-time updates keep everyone in the loop, even if you're playing in different groups.",
    icon: Radio,
    image: "/images/golf-afternoon.jpg",
    accent: "amber",
    stat: "Live",
    statLabel: "Updates",
  },
  {
    title: "Easy Settlement",
    description: "No cash, no IOUs. Pay and confirm through Venmo, Cash App, Zelle, or Apple Cash.",
    icon: CreditCard,
    image: "/images/golf-dusk.jpg",
    accent: "green",
    stat: "$0",
    statLabel: "Disputes",
  },
];

const gridFeatures = [
  {
    title: "Up to 16 Players",
    description: "Big group? No problem.",
    icon: Users,
    color: "text-brand",
    bg: "bg-brand/10",
  },
  {
    title: "Auto-Calculate",
    description: "No math required.",
    icon: Calculator,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    title: "GHIN Handicaps",
    description: "Enter your GHIN number to verify your handicap.",
    icon: BadgeCheck,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    title: "Dots",
    description: "Track greenies, sandies, and poleys.",
    icon: Target,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    title: "Career Stats",
    description: "Track your all-time results.",
    icon: Trophy,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    title: "Quick Setup",
    description: "Start a round in under a minute.",
    icon: Zap,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    title: "Course Search",
    description: "Browse and search courses with full scorecards and slope ratings.",
    icon: Search,
    color: "text-sky-400",
    bg: "bg-sky-400/10",
  },
  {
    title: "Groups & Challenges",
    description: "Organize your regular crew and send 1v1 challenges.",
    icon: Swords,
    color: "text-rose-400",
    bg: "bg-rose-400/10",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" aria-label="Features" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 mb-4">
            <TrendingUp className="w-4 h-4 text-brand" />
            <span className="text-brand text-sm font-medium">Everything You Need</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            From Tee to Settlement
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Press handles every aspect of your golf side games, so you can focus on what matters.
          </p>
        </div>

        {/* Hero Features - 3 large cards with images */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {heroFeatures.map((feature, index) => {
            const Icon = feature.icon;
            const accentColors = {
              brand: "border-brand/30 text-brand",
              amber: "border-amber-500/30 text-amber-400",
              green: "border-green-500/30 text-green-400",
            };
            const accent = accentColors[feature.accent as keyof typeof accentColors];
            const bgColors = {
              brand: "bg-brand/20",
              amber: "bg-amber-500/20",
              green: "bg-green-500/20",
            };

            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Background Image */}
                <div className="absolute inset-0">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40" />
                </div>

                {/* Content */}
                <div className="relative z-10 p-6 h-full min-h-[320px] flex flex-col">
                  {/* Stat badge */}
                  <div className={`self-start px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border ${accent.split(' ')[0]} mb-auto`}>
                    <p className={`font-bold text-lg ${accent.split(' ')[1]}`}>{feature.stat}</p>
                    <p className="text-white/60 text-xs">{feature.statLabel}</p>
                  </div>

                  {/* Title and description */}
                  <div className="mt-auto">
                    <div className={`w-10 h-10 rounded-xl ${bgColors[feature.accent as keyof typeof bgColors]} flex items-center justify-center mb-3`}>
                      <Icon className={`w-5 h-5 ${accent.split(' ')[1]}`} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-white/70 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid Features - 6 smaller cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {gridFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="glass-card p-4 rounded-xl hover:bg-white/5 transition-all duration-300 animate-fade-in-up group"
                style={{ animationDelay: `${(index + 3) * 100}ms` }}
              >
                <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{feature.title}</h3>
                <p className="text-white/65 text-xs">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
