"use client";

import { useState } from "react";
import Image from "next/image";
import { Smartphone, ChevronLeft, ChevronRight } from "lucide-react";

const screenshots = [
  {
    src: "/screenshots/dashboard.png",
    alt: "Press Dashboard - Career earnings and start a round",
    label: "Dashboard",
    description: "Track your career earnings and quickly start new rounds",
  },
  {
    src: "/screenshots/games.png",
    alt: "Add a Game - Choose from 10 betting games",
    label: "Game Selection",
    description: "Choose from 10 game types with built-in rules",
  },
  {
    src: "/screenshots/scorecard.png",
    alt: "Live Scorecard - Real-time scoring",
    label: "Live Scoring",
    description: "Enter scores hole by hole with live updates",
  },
  {
    src: "/screenshots/profile.png",
    alt: "Profile - Handicap and settings",
    label: "Profile",
    description: "Manage your handicap and payment methods",
  },
];

export function AppPreviewSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % screenshots.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
  };

  return (
    <section className="py-20 px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 text-sm font-medium">See It In Action</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            Designed for Golfers
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            A beautiful, intuitive interface that gets out of your way so you can focus on the game.
          </p>
        </div>

        {/* Phone mockup with side cards */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
          {/* Left info card */}
          <div className="hidden lg:block w-64 text-right">
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-white font-bold text-lg mb-2">{screenshots[activeIndex].label}</h3>
              <p className="text-white/60 text-sm">{screenshots[activeIndex].description}</p>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-8 bg-brand/20 blur-3xl rounded-full opacity-50" />

            {/* Navigation arrows - mobile */}
            <button
              onClick={prevSlide}
              className="lg:hidden absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-10 h-10 rounded-full glass-card flex items-center justify-center text-white/70 hover:text-white z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              className="lg:hidden absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-10 h-10 rounded-full glass-card flex items-center justify-center text-white/70 hover:text-white z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Phone frame */}
            <div className="relative w-[300px] h-[620px] bg-[#1a1a1a] rounded-[3rem] p-2 shadow-2xl border border-white/10">
              <div className="w-full h-full bg-[#0a1628] rounded-[2.5rem] overflow-hidden relative">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1a1a1a] rounded-b-2xl z-20" />

                {/* Screenshot */}
                <Image
                  src={screenshots[activeIndex].src}
                  alt={screenshots[activeIndex].alt}
                  fill
                  className="object-cover object-top transition-opacity duration-300"
                  priority
                  sizes="300px"
                />
              </div>
            </div>

            {/* Navigation arrows - desktop */}
            <button
              onClick={prevSlide}
              className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 w-12 h-12 rounded-full glass-card items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 w-12 h-12 rounded-full glass-card items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Right navigation */}
          <div className="lg:w-64">
            {/* Mobile description */}
            <div className="lg:hidden text-center mb-4">
              <h3 className="text-white font-bold text-lg">{screenshots[activeIndex].label}</h3>
              <p className="text-white/60 text-sm">{screenshots[activeIndex].description}</p>
            </div>

            {/* Screenshot pills */}
            <div className="flex lg:flex-col justify-center gap-2">
              {screenshots.map((screenshot, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    index === activeIndex
                      ? "bg-brand text-white shadow-lg shadow-brand/30"
                      : "glass-card text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {screenshot.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
