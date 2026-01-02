"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { api } from "@/lib/api";

export default function EditProfilePage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [ghinNumber, setGhinNumber] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = await getToken();
        if (!token) return;
        const user = await api.getMe(token);
        setFirstName(user.firstName || clerkUser?.firstName || "");
        setLastName(user.lastName || clerkUser?.lastName || "");
        setDisplayName(user.displayName || "");
        setPhone(user.phone || "");
        setGhinNumber(user.ghinNumber || "");
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [getToken, clerkUser]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await api.updateMe(token, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        displayName: displayName || undefined,
        phone: phone || undefined,
        ghinNumber: ghinNumber || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/profile");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Personal Info</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-brand font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-brand/10 border border-brand/20 text-brand text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            Profile saved successfully!
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              First Name
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
              Last Name
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
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How others see you"
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
            />
            <p className="text-xs text-muted mt-1">
              Optional nickname shown to other players
            </p>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              GHIN Number
            </label>
            <input
              type="text"
              value={ghinNumber}
              onChange={(e) => setGhinNumber(e.target.value)}
              placeholder="Your GHIN ID"
              className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
            />
            <p className="text-xs text-muted mt-1">
              Your official USGA handicap ID
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
