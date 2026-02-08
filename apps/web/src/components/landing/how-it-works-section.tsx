"use client";

import { MapPin, Users, Play, Trophy } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Pick Your Course",
    description: "Search 15,000+ courses with full scorecards and slope ratings.",
    icon: MapPin,
    color: "text-brand",
    bg: "bg-brand/20",
    border: "border-brand/30",
  },
  {
    number: 2,
    title: "Add Your Buddies",
    description: "Invite players via text or link. Everyone joins from their phone.",
    icon: Users,
    color: "text-amber-400",
    bg: "bg-amber-400/20",
    border: "border-amber-400/30",
  },
  {
    number: 3,
    title: "Choose Your Games",
    description: "Select from 10 game types. Set your bets and press rules.",
    icon: Play,
    color: "text-blue-400",
    bg: "bg-blue-400/20",
    border: "border-blue-400/30",
  },
  {
    number: 4,
    title: "Play & Settle Up",
    description: "Enter scores as you play. Press calculates who owes who instantly.",
    icon: Trophy,
    color: "text-green-400",
    bg: "bg-green-400/20",
    border: "border-green-400/30",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" aria-label="How it works" className="py-20 px-6 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Set up your round in under a minute. Really.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Connector line (not on last item) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-40px)] h-[2px] bg-gradient-to-r from-white/20 to-transparent" />
                )}

                {/* Card */}
                <div className="glass-card p-6 rounded-2xl h-full">
                  {/* Number badge */}
                  <div className={`w-12 h-12 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center mb-4`}>
                    <span className={`text-xl font-bold ${step.color}`}>{step.number}</span>
                  </div>

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg ${step.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${step.color}`} />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-white/60 text-sm">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
