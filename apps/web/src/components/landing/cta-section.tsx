"use client";

import Link from "next/link";
import Image from "next/image";
import { Crown, Check, CreditCard, LogIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { useUserState } from "@/hooks/use-user-state";

const benefits = [
  "10 game types included",
  "Unlimited rounds",
  "Auto-calculate results",
  "Settle up instantly",
];

const paymentMethods = [
  { name: "Venmo", color: "#3D95CE" },
  { name: "Cash App", color: "#00D632" },
  { name: "Zelle", color: "#6D1ED4" },
  { name: "Apple Cash", color: "#FFFFFF" },
];

export function CtaSection() {
  const userState = useUserState();

  return (
    <section aria-label="Call to action" className="py-24 px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/golf-dusk.jpg"
          alt="Golf course at dusk"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628] via-black/80 to-[#0a1628]" />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="glass-card rounded-3xl p-8 lg:p-12 relative overflow-hidden">
          {/* Glow accents */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div>
              <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
                Ready to Play?
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Join thousands of golfers tracking their side games. Start your round in under a minute.
              </p>

              {/* Benefits */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-brand" />
                    </div>
                    <span className="text-white/80 text-sm">{benefit}</span>
                  </div>
                ))}
              </div>

              {/* CTAs - Dynamic based on user state */}
              <div className="flex flex-col sm:flex-row gap-4">
                {userState === "loading" ? (
                  <div className="h-14 w-48 bg-white/10 rounded-lg animate-pulse" />
                ) : userState === "authenticated" ? (
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
                    <Link href="/sign-up">
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto h-14 px-8 text-base font-semibold bg-white/10 hover:bg-white/20 border border-white/20"
                        size="lg"
                      >
                        New Account
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/sign-up">
                      <Button
                        className="w-full sm:w-auto h-14 px-8 text-base font-semibold shadow-lg shadow-brand/30"
                        size="lg"
                      >
                        <Crown className="h-5 w-5 mr-2" />
                        Get Started - $2.49/mo
                      </Button>
                    </Link>
                    <Link href="/sign-in">
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto h-14 px-8 text-base font-semibold bg-white/10 hover:bg-white/20 border border-white/20"
                        size="lg"
                      >
                        Sign In
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              {userState !== "authenticated" && (
                <p className="text-sm text-white/60 mt-4">
                  $2.49/month or $19.99/year • Cancel anytime
                </p>
              )}
            </div>

            {/* Right: Payment methods card */}
            <div className="glass-card p-8 rounded-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Settle Up Instantly</h3>
                  <p className="text-white/60 text-sm">Pay or get paid with one tap</p>
                </div>
              </div>

              <p className="text-white/60 text-sm mb-6">
                When the round ends, Press calculates exactly who owes who. No more Venmo requests with confusing amounts.
              </p>

              {/* Payment method badges */}
              <div className="flex flex-wrap gap-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.name}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: method.color }}
                    />
                    <span className="text-sm font-medium text-white">
                      {method.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
