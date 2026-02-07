"use client";

import Link from "next/link";
import Image from "next/image";
import { Crown, ChevronDown, Play, Sparkles, LogIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { useUserState } from "@/hooks/use-user-state";

export function HeroSection() {
  const userState = useUserState();
  return (
    <section className="min-h-screen relative flex flex-col overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/golf-hero.jpg"
          alt="Golf course background"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-[#0a1628]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Top spacing */}
        <div className="flex-1 min-h-[15vh]" />

        {/* Main content */}
        <div className="px-6 max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div className="text-center lg:text-left">
              {/* Logo */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                <Sparkles className="w-4 h-4 text-brand" />
                <span className="text-white/80 text-sm font-medium">Golf's #1 Side Game App</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-white drop-shadow-2xl mb-3">
                PRESS
              </h1>
              <p className="text-white/50 text-xs uppercase tracking-[0.25em] font-medium mb-6">
                Your Side Games Managed For You
              </p>

              {/* Tagline */}
              <p className="text-2xl lg:text-3xl text-white/90 font-semibold mb-3">
                Side games made simple.
              </p>
              <p className="text-lg text-white/60 mb-8 max-w-md mx-auto lg:mx-0">
                Track games with your buddies. Nassau, Skins, Wolf, and 7 more formats.
                No math. No arguments. Just golf.
              </p>

              {/* CTAs - Dynamic based on user state */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {userState === "loading" ? (
                  // Show skeleton while loading to prevent layout shift
                  <div className="h-14 w-64 bg-white/10 rounded-lg animate-pulse" />
                ) : userState === "authenticated" ? (
                  // Authenticated user - go to dashboard
                  <Link href="/dashboard">
                    <Button
                      className="w-full sm:w-auto h-14 px-8 text-base font-semibold shadow-lg shadow-brand/30"
                      size="lg"
                    >
                      <ArrowRight className="h-5 w-5 mr-2" />
                      Go to Dashboard
                    </Button>
                  </Link>
                ) : userState === "returning" ? (
                  // Returning user - sign in as primary
                  <>
                    <Link href="/sign-in">
                      <Button
                        className="w-full sm:w-auto h-14 px-8 text-base font-semibold shadow-lg shadow-brand/30"
                        size="lg"
                      >
                        <LogIn className="h-5 w-5 mr-2" />
                        Welcome Back - Sign In
                      </Button>
                    </Link>
                    <Link href="#features">
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto h-14 px-8 text-base font-semibold bg-white/10 hover:bg-white/20 border border-white/20"
                        size="lg"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        See How It Works
                      </Button>
                    </Link>
                  </>
                ) : (
                  // New user - sign up
                  <>
                    <Link href="/sign-up">
                      <Button
                        className="w-full sm:w-auto h-14 px-8 text-base font-semibold shadow-lg shadow-brand/30"
                        size="lg"
                      >
                        <Crown className="h-5 w-5 mr-2" />
                        Get Started - $2.49/month
                      </Button>
                    </Link>
                    <Link href="#features">
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto h-14 px-8 text-base font-semibold bg-white/10 hover:bg-white/20 border border-white/20"
                        size="lg"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        See How It Works
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {userState !== "authenticated" && (
                <p className="text-xs text-white/40 mt-4">Cancel anytime • No commitment</p>
              )}
            </div>

            {/* Right: Floating phone mockup */}
            <div className="hidden lg:flex justify-center items-center">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute -inset-4 bg-brand/20 blur-3xl rounded-full" />

                {/* Phone frame */}
                <div className="relative w-[280px] h-[580px] bg-[#1a1a1a] rounded-[3rem] p-2 shadow-2xl border border-white/10">
                  <div className="w-full h-full bg-[#0a1628] rounded-[2.5rem] overflow-hidden relative">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1a1a1a] rounded-b-2xl z-20" />

                    {/* Screenshot */}
                    <Image
                      src="/screenshots/dashboard.png"
                      alt="Press app dashboard"
                      fill
                      className="object-cover object-top"
                      sizes="280px"
                    />
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -left-12 top-20 animate-float">
                  <div className="px-4 py-2 rounded-xl bg-green-500/20 backdrop-blur-sm border border-green-500/30 shadow-lg">
                    <p className="text-green-400 font-bold text-lg">+$47</p>
                    <p className="text-green-400/70 text-xs">Nassau Win</p>
                  </div>
                </div>

                <div className="absolute -right-8 top-40 animate-float" style={{ animationDelay: "0.5s" }}>
                  <div className="px-4 py-2 rounded-xl bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 shadow-lg">
                    <p className="text-amber-400 font-bold">Hole 7</p>
                    <p className="text-amber-400/70 text-xs">2 UP</p>
                  </div>
                </div>

                <div className="absolute -left-8 bottom-32 animate-float" style={{ animationDelay: "1s" }}>
                  <div className="px-4 py-2 rounded-xl bg-brand/20 backdrop-blur-sm border border-brand/30 shadow-lg">
                    <p className="text-brand font-bold">Skin!</p>
                    <p className="text-brand/70 text-xs">Birdie on 12</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom spacing with scroll indicator */}
        <div className="flex-1 min-h-[15vh] flex flex-col items-center justify-end pb-8">
          <a href="#features" className="text-white/50 hover:text-white/70 transition-colors animate-bounce">
            <ChevronDown className="h-8 w-8" />
          </a>
        </div>
      </div>
    </section>
  );
}
