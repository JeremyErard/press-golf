"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";

// Simple validation functions
const validatePhone = (phone: string): string | null => {
  if (!phone) return null; // Optional field
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 10 || cleaned.length > 15) {
    return "Phone number must be 10-15 digits";
  }
  return null;
};

const validateGhinNumber = (ghin: string): string | null => {
  if (!ghin) return null; // Optional field
  if (!/^\d{7}$/.test(ghin)) {
    return "GHIN number must be exactly 7 digits";
  }
  return null;
};

const validateDisplayName = (name: string): string | null => {
  if (!name) return null; // Optional field
  if (name.length > 30) {
    return "Display name must be 30 characters or less";
  }
  return null;
};

interface FormErrors {
  phone?: string | null;
  ghinNumber?: string | null;
  displayName?: string | null;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [ghinNumber, setGhinNumber] = useState("");

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [getToken, clerkUser]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {
      phone: validatePhone(phone),
      ghinNumber: validateGhinNumber(ghinNumber),
      displayName: validateDisplayName(displayName),
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  }, [phone, ghinNumber, displayName]);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Validate on blur
    if (field === "phone") {
      setErrors((prev) => ({ ...prev, phone: validatePhone(phone) }));
    } else if (field === "ghinNumber") {
      setErrors((prev) => ({ ...prev, ghinNumber: validateGhinNumber(ghinNumber) }));
    } else if (field === "displayName") {
      setErrors((prev) => ({ ...prev, displayName: validateDisplayName(displayName) }));
    }
  };

  const handleSave = async () => {
    // Mark all fields as touched
    setTouched({
      firstName: true,
      lastName: true,
      displayName: true,
      phone: true,
      ghinNumber: true,
    });

    if (!validateForm()) {
      toast.error("Please fix validation errors before saving");
      return;
    }

    setSaving(true);

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

      toast.success("Profile saved successfully");
      router.push("/profile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
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
      <Header
        title="Edit Profile"
        showBack
        rightAction={
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-brand font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save"}
          </button>
        }
      />

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-4 space-y-6">
        <div className="space-y-4">
          <Input
            label="First Name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Your first name"
          />

          <Input
            label="Last Name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Your last name"
          />

          <div>
            <Input
              label="Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => handleBlur("displayName")}
              placeholder="How others see you"
              error={touched.displayName ? errors.displayName ?? undefined : undefined}
            />
            <p className="text-xs text-muted mt-1">
              Optional nickname shown to other players (max 30 characters)
            </p>
          </div>

          <Input
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => handleBlur("phone")}
            placeholder="+1 (555) 123-4567"
            error={touched.phone ? errors.phone ?? undefined : undefined}
          />

          <div>
            <Input
              label="GHIN Number"
              type="text"
              value={ghinNumber}
              onChange={(e) => setGhinNumber(e.target.value)}
              onBlur={() => handleBlur("ghinNumber")}
              placeholder="Your GHIN ID"
              error={touched.ghinNumber ? errors.ghinNumber ?? undefined : undefined}
              maxLength={7}
            />
            <p className="text-xs text-muted mt-1">
              Your official USGA handicap ID (7 digits)
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
