"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Plus, Trash2, Star, Loader2, Check } from "lucide-react";
import { api, PaymentMethod, PaymentMethodType } from "@/lib/api";

const PAYMENT_TYPES: { type: PaymentMethodType; label: string; placeholder: string; prefix: string }[] = [
  { type: "VENMO", label: "Venmo", placeholder: "@username", prefix: "@" },
  { type: "CASHAPP", label: "Cash App", placeholder: "$cashtag", prefix: "$" },
  { type: "ZELLE", label: "Zelle", placeholder: "Email or phone", prefix: "" },
  { type: "APPLE_PAY", label: "Apple Cash", placeholder: "Phone number", prefix: "" },
];

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<PaymentMethodType>("VENMO");
  const [newHandle, setNewHandle] = useState("");

  const fetchMethods = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getPaymentMethods(token);
      setMethods(data);
    } catch (err) {
      console.error("Failed to fetch payment methods:", err);
      setError("Failed to load payment methods");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleAdd = async () => {
    if (!newHandle.trim()) {
      setError("Please enter a handle");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await api.addPaymentMethod(token, {
        type: newType,
        handle: newHandle.trim(),
        isPreferred: methods.length === 0, // First one is preferred
      });

      setSuccess("Payment method added!");
      setShowAddForm(false);
      setNewHandle("");
      fetchMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add payment method");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await api.deletePaymentMethod(token, id);
      setMethods((prev) => prev.filter((m) => m.id !== id));
      setSuccess("Payment method removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payment method");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetPreferred = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await api.setPreferredPaymentMethod(token, id);
      setMethods((prev) =>
        prev.map((m) => ({
          ...m,
          isPreferred: m.id === id,
        }))
      );
      setSuccess("Preferred payment method updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update preferred method");
    }
  };

  const getTypeConfig = (type: PaymentMethodType) => {
    return PAYMENT_TYPES.find((t) => t.type === type) || PAYMENT_TYPES[0];
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

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
          <h1 className="text-lg font-semibold text-foreground">Payment Methods</h1>
          <div className="w-5" />
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
            {success}
          </div>
        )}

        <p className="text-sm text-muted">
          Add your payment apps so other players can settle up with you easily.
        </p>

        {/* Existing Methods */}
        <div className="space-y-3">
          {methods.map((method) => {
            const config = getTypeConfig(method.type);
            return (
              <div
                key={method.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center">
                    <span className="text-sm font-semibold text-foreground">
                      {config.label.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{config.label}</p>
                      {method.isPreferred && (
                        <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full">
                          Preferred
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted">{method.handle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.isPreferred && (
                    <button
                      onClick={() => handleSetPreferred(method.id)}
                      className="p-2 rounded-lg hover:bg-elevated transition-colors"
                      title="Set as preferred"
                    >
                      <Star className="w-4 h-4 text-muted" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(method.id)}
                    disabled={deletingId === method.id}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                  >
                    {deletingId === method.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Form */}
        {showAddForm ? (
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Payment Type
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as PaymentMethodType)}
                className="w-full px-4 py-3 rounded-xl bg-elevated border border-border text-foreground focus:outline-none focus:border-brand"
              >
                {PAYMENT_TYPES.map((type) => (
                  <option key={type.type} value={type.type}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                {getTypeConfig(newType).label} Handle
              </label>
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder={getTypeConfig(newType).placeholder}
                className="w-full px-4 py-3 rounded-xl bg-elevated border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewHandle("");
                  setError(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-elevated border border-border text-foreground font-medium hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newHandle.trim()}
                className="flex-1 py-3 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Add"
                )}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-border text-muted hover:border-brand hover:text-brand transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Payment Method
          </button>
        )}
      </div>
    </div>
  );
}
