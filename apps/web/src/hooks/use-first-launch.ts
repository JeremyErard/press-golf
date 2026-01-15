"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "press_has_seen_explainer";

export function useFirstLaunch() {
  const [hasSeenExplainer, setHasSeenExplainer] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY);
    setHasSeenExplainer(stored === "true");
    setIsLoading(false);
  }, []);

  const markExplainerSeen = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setHasSeenExplainer(true);
  };

  const resetExplainer = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHasSeenExplainer(false);
  };

  return {
    hasSeenExplainer,
    isLoading,
    markExplainerSeen,
    resetExplainer,
    showExplainer: !isLoading && hasSeenExplainer === false,
  };
}
