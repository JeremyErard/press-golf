"use client";

import { useState, useEffect } from "react";
import { Download, Share, X } from "lucide-react";
import { getInstallInstructions, showInstallPrompt, setupInstallPrompt } from "@/lib/pwa";
import { isStandalone } from "@/lib/utils";

export function InstallButton() {
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [instructions, setInstructions] = useState<ReturnType<typeof getInstallInstructions> | null>(null);

  useEffect(() => {
    setupInstallPrompt();
    setIsInstalled(isStandalone());
    setInstructions(getInstallInstructions());
  }, []);

  // Don't show if already installed
  if (isInstalled) return null;

  const handleInstall = async () => {
    if (instructions?.canPrompt) {
      const accepted = await showInstallPrompt();
      if (accepted) {
        setIsInstalled(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstall}
        className="flex items-center justify-center gap-2 w-full mt-4 py-3 px-4 rounded-xl bg-white/10 backdrop-blur border border-white/20 text-white/90 text-sm font-medium hover:bg-white/20 transition-all"
      >
        <Download className="w-4 h-4" />
        Add to Home Screen
      </button>

      {/* Instructions Modal */}
      {showInstructions && instructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a2942] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Install Press</h3>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            <div className="space-y-3">
              {instructions.steps.map((step, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand/20 text-brand text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <p className="text-white/80 text-sm">{step}</p>
                </div>
              ))}
            </div>

            {instructions.platform === "ios" && (
              <div className="mt-4 p-3 rounded-lg bg-white/5 flex items-center gap-2">
                <Share className="w-5 h-5 text-white/60" />
                <span className="text-white/60 text-xs">Look for this icon in Safari</span>
              </div>
            )}

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
