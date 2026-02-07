"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  Crown,
  User,
  Flag,
  Wallet,
  Smartphone,
  Check,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type PaymentType = "VENMO" | "ZELLE" | "CASHAPP" | "APPLE_PAY";

const steps = [
  { id: 1, name: "Subscribe", icon: Crown },
  { id: 2, name: "Profile", icon: User },
  { id: 3, name: "Handicap", icon: Flag },
  { id: 4, name: "Settle", icon: Wallet },
  { id: 5, name: "Install", icon: Smartphone },
  { id: 6, name: "Done", icon: Check },
];

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const checkoutSuccess = searchParams.get("checkout") === "success";

  // Step 2: Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Step 3: Handicap
  const [handicapIndex, setHandicapIndex] = useState("");
  const [ghinNumber, setGhinNumber] = useState("");

  // Step 4: Payment
  const [paymentType, setPaymentType] = useState<PaymentType>("VENMO");
  const [paymentHandle, setPaymentHandle] = useState("");

  // Check subscription status and PWA install prompt
  useEffect(() => {
    let pollCount = 0;
    let pollInterval: NodeJS.Timeout | null = null;

    async function checkStatus() {
      try {
        const token = await getToken();
        if (!token) {
          setCheckingSubscription(false);
          return;
        }

        const status = await api.getBillingStatus(token);

        // If already subscribed or founding member, skip to profile
        if (status.status === "ACTIVE" || status.status === "FOUNDING" || status.isFoundingMember) {
          if (pollInterval) clearInterval(pollInterval);

          // Check if there's a stored redirect from invite flow
          if (checkoutSuccess) {
            const storedRedirect = sessionStorage.getItem("subscriptionRedirect");
            if (storedRedirect) {
              sessionStorage.removeItem("subscriptionRedirect");
              router.replace(storedRedirect);
              return;
            }
          }

          setCurrentStep(2);
          // Pre-fill from Clerk
          setFirstName(clerkUser?.firstName || "");
          setLastName(clerkUser?.lastName || "");
          setCheckingSubscription(false);
          // Clear the query param
          if (checkoutSuccess) {
            router.replace("/onboarding");
          }
        } else if (checkoutSuccess && pollCount < 10) {
          // If returning from checkout, poll until subscription is active
          pollCount++;
          // Keep checking
        } else {
          setCheckingSubscription(false);
        }
      } catch (err) {
        console.error("Status check failed:", err);
        setCheckingSubscription(false);
      }
    }

    checkStatus();

    // If returning from checkout success, poll with exponential backoff
    if (checkoutSuccess) {
      let delay = 2000;
      const maxDelay = 5000;
      const deadline = Date.now() + 15000;
      const cancelled = false;

      const poll = () => {
        if (cancelled || Date.now() >= deadline) {
          setCheckingSubscription(false);
          return;
        }
        pollInterval = setTimeout(() => {
          checkStatus().then(() => {
            delay = Math.min(delay * 1.5, maxDelay);
            poll();
          });
        }, delay) as unknown as ReturnType<typeof setInterval>;
      };
      poll();
    }

    return () => {
      if (pollInterval) clearTimeout(pollInterval as unknown as ReturnType<typeof setTimeout>);
    };
  }, [getToken, clerkUser, checkoutSuccess, router]);

  // Listen for PWA install prompt (separate effect to avoid dead code)
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  // Pre-fill profile from Clerk when moving to step 2
  useEffect(() => {
    if (currentStep === 2 && clerkUser) {
      setFirstName(clerkUser.firstName || "");
      setLastName(clerkUser.lastName || "");
    }
  }, [currentStep, clerkUser]);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const { url } = await api.createCheckoutSession(token);
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setLoading(false);
    }
  };

  const handleNext = async () => {
    setError(null);
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      if (currentStep === 2) {
        // Validate
        if (!firstName.trim() || !lastName.trim()) {
          throw new Error("Please enter your name");
        }

        // Save profile
        await api.updateMe(token, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        });

        setCurrentStep(3);
      } else if (currentStep === 3) {
        // Save handicap (optional)
        const updateData: Record<string, unknown> = {};
        if (handicapIndex) {
          const hcp = parseFloat(handicapIndex);
          if (isNaN(hcp) || hcp < -10 || hcp > 54) {
            throw new Error("Handicap must be between -10 and 54");
          }
          updateData.handicapIndex = hcp;
        }
        if (ghinNumber) {
          updateData.ghinNumber = ghinNumber.trim();
        }

        if (Object.keys(updateData).length > 0) {
          await api.updateMe(token, updateData);
        }

        setCurrentStep(4);
      } else if (currentStep === 4) {
        // Save payment method (optional but recommended)
        if (paymentHandle.trim()) {
          await api.addPaymentMethod(token, {
            type: paymentType,
            handle: paymentHandle.trim(),
            isPreferred: true,
          });
        }

        setCurrentStep(5);
      } else if (currentStep === 5) {
        // Skip to done
        setCurrentStep(6);
      } else if (currentStep === 6) {
        // Mark onboarding complete and go to dashboard
        await api.completeOnboarding(token);
        sessionStorage.setItem("press_onboarding_complete", "true");
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!installPrompt) return;

    try {
      // @ts-expect-error - prompt() exists on BeforeInstallPromptEvent
      await installPrompt.prompt();
      // @ts-expect-error - userChoice exists on BeforeInstallPromptEvent
      const { outcome } = await installPrompt.userChoice;

      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    } catch (err) {
      console.error("Install failed:", err);
    }
  };

  const handleBack = () => {
    if (currentStep > 2) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleSkip = () => {
    if (currentStep >= 3 && currentStep <= 5) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  if (checkingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted mt-4">
            {checkoutSuccess ? "Confirming your subscription..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          {currentStep > 2 && currentStep < 6 ? (
            <button
              onClick={handleBack}
              className="text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-5" />
          )}
          <h1 className="text-lg font-semibold text-foreground">
            {currentStep === 1
              ? "Join Press"
              : currentStep === 6
              ? "You're all set!"
              : "Set up your profile"}
          </h1>
          <div className="w-5" />
        </div>
      </div>

      {/* Progress - only show after subscription */}
      {currentStep > 1 && (
        <div className="px-4 py-6">
          <div className="flex items-center justify-center gap-1">
            {steps.slice(1).map((step, idx) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full transition-all ${
                      isCompleted
                        ? "bg-brand"
                        : isActive
                        ? "bg-brand w-4"
                        : "bg-border"
                    }`}
                  />
                  {idx < steps.length - 2 && <div className="w-4" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-32">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Subscribe */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8 pt-8">
              <div className="w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-6">
                <Crown className="w-10 h-10 text-brand" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Welcome to Press!</h2>
              <p className="text-muted mt-2">Your side games managed for you</p>
            </div>

            {/* Pricing */}
            <div className="bg-gradient-to-br from-brand/20 to-green-600/10 border border-brand/30 rounded-2xl p-6 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">$2.49</span>
                <span className="text-muted">/month</span>
              </div>
              <p className="text-sm text-muted mt-2">Or $19.99/year (save 33%) • Cancel anytime</p>
            </div>

            {/* Features */}
            <div className="space-y-3">
              {[
                "Unlimited rounds with your buddies",
                "All 10 game types (Nassau, Skins, Wolf...)",
                "Auto-calculated scores & winnings",
                "Settlement tracking - who owes who",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-brand" />
                  </div>
                  <span className="text-foreground text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Profile */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Your Profile</h2>
              <p className="text-muted mt-2">How your buddies will see you</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
                />
                <p className="text-xs text-muted mt-1">
                  So your buddies can reach you
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Handicap */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Your Handicap</h2>
              <p className="text-muted mt-2">Used for calculating strokes</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Handicap Index
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={handicapIndex}
                  onChange={(e) => setHandicapIndex(e.target.value)}
                  placeholder="e.g., 12.5"
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  GHIN Number
                </label>
                <input
                  type="text"
                  value={ghinNumber}
                  onChange={(e) => setGhinNumber(e.target.value)}
                  placeholder="e.g., 1234567"
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Settlement Payment */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Settlement Method</h2>
              <p className="text-muted mt-2">How you'll pay and get paid</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Payment App
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["VENMO", "ZELLE", "CASHAPP", "APPLE_PAY"] as PaymentType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPaymentType(type)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                        paymentType === type
                          ? "bg-brand/20 border-brand text-brand"
                          : "bg-card border-border text-muted hover:border-brand/50"
                      }`}
                    >
                      {type === "CASHAPP" ? "Cash App" : type === "APPLE_PAY" ? "Apple Cash" : type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  {paymentType === "VENMO"
                    ? "Venmo Username"
                    : paymentType === "ZELLE"
                    ? "Zelle Email or Phone"
                    : paymentType === "APPLE_PAY"
                    ? "Phone Number"
                    : "Cash App $Cashtag"}
                </label>
                <input
                  type="text"
                  value={paymentHandle}
                  onChange={(e) => setPaymentHandle(e.target.value)}
                  placeholder={
                    paymentType === "VENMO"
                      ? "@username"
                      : paymentType === "ZELLE"
                      ? "email@example.com"
                      : paymentType === "APPLE_PAY"
                      ? "+1 (555) 123-4567"
                      : "$cashtag"
                  }
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Install PWA */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="text-center mb-8 pt-4">
              <div className="w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-6">
                <Smartphone className="w-10 h-10 text-brand" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Add to Home Screen</h2>
              <p className="text-muted mt-2">Get the full app experience</p>
            </div>

            {isInstalled ? (
              <div className="text-center p-6 rounded-xl bg-brand/10 border border-brand/20">
                <Check className="w-8 h-8 text-brand mx-auto mb-2" />
                <p className="text-brand font-medium">Press is installed!</p>
              </div>
            ) : installPrompt ? (
              <button
                onClick={handleInstall}
                className="w-full py-4 px-4 rounded-xl bg-surface border border-border text-foreground font-medium flex items-center justify-center gap-3"
              >
                <Download className="w-5 h-5" />
                Install Press App
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted text-center">
                  To install Press on your device:
                </p>
                <div className="bg-surface rounded-xl p-4 space-y-3 text-sm">
                  <p className="text-foreground font-medium">On iPhone/iPad:</p>
                  <p className="text-muted">
                    Tap the Share button, then "Add to Home Screen"
                  </p>
                </div>
                <div className="bg-surface rounded-xl p-4 space-y-3 text-sm">
                  <p className="text-foreground font-medium">On Android:</p>
                  <p className="text-muted">
                    Tap the menu (⋮), then "Add to Home Screen"
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Complete */}
        {currentStep === 6 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-brand" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">You're all set!</h2>
            <p className="text-muted mb-8">
              Start a round or join one with your buddies.
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border safe-area-bottom">
        <div className="flex gap-3">
          {currentStep >= 3 && currentStep <= 5 && (
            <button
              onClick={handleSkip}
              className="flex-1 py-4 px-4 rounded-xl bg-surface border border-border text-muted font-medium"
            >
              Skip
            </button>
          )}

          {currentStep === 1 ? (
            <div className="flex-1 flex flex-col gap-2">
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-4 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Crown className="w-5 h-5" />
                    Subscribe - $2.49/mo
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleNext}
              disabled={loading || (currentStep === 2 && (!firstName.trim() || !lastName.trim()))}
              className="flex-1 py-4 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : currentStep === 6 ? (
                "Go to Dashboard"
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
