"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, RefreshCw, Activity, Database, Users, Zap, AlertTriangle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface Metrics {
  timestamp: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  requests: {
    total: number;
    errors: number;
    errorRate: string;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    percentUsed: string;
  };
  users: {
    total: number;
    subscribers: number;
  };
  rounds: {
    active: number;
  };
  alerts: string[];
}

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  uptime: number;
  database: string;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

export default function StatusPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://press-api.onrender.com";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch(`${apiUrl}/health`),
        fetch(`${apiUrl}/metrics`),
      ]);

      if (!healthRes.ok || !metricsRes.ok) {
        throw new Error("Failed to fetch status");
      }

      const [healthData, metricsData] = await Promise.all([
        healthRes.json(),
        metricsRes.json(),
      ]);

      setHealth(healthData);
      setMetrics(metricsData);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isHealthy = health?.status === "healthy";
  const hasAlerts = metrics?.alerts && !metrics.alerts.includes("All systems nominal");

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
          <h1 className="text-lg font-semibold text-foreground">System Status</h1>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Overall Status */}
        <div className={`p-6 rounded-2xl border ${
          isHealthy
            ? "bg-green-500/10 border-green-500/20"
            : "bg-yellow-500/10 border-yellow-500/20"
        }`}>
          <div className="flex items-center gap-4">
            {isHealthy ? (
              <CheckCircle className="w-10 h-10 text-green-500" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-yellow-500" />
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {isHealthy ? "All Systems Operational" : "Degraded Performance"}
              </h2>
              <p className="text-muted text-sm">
                Last checked: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Users</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {metrics?.users.total ?? "-"}
            </p>
            <p className="text-xs text-muted">
              {metrics?.users.subscribers ?? 0} subscribers
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted mb-2">
              <Activity className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Active Rounds</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {metrics?.rounds.active ?? "-"}
            </p>
            <p className="text-xs text-muted">in progress</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted mb-2">
              <Zap className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Requests</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {metrics?.requests.total.toLocaleString() ?? "-"}
            </p>
            <p className="text-xs text-muted">
              {metrics?.requests.errorRate} error rate
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted mb-2">
              <Database className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wide">Database</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {health?.database === "ok" ? "Connected" : "Error"}
            </p>
            <p className="text-xs text-muted">
              {health?.database === "ok" ? "healthy" : "check connection"}
            </p>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
            Memory Usage
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Heap Used</span>
                <span className="text-foreground font-medium">
                  {metrics?.memory.heapUsedMB ?? 0} / {metrics?.memory.heapTotalMB ?? 0} MB
                </span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{
                    width: metrics?.memory.percentUsed ?? "0%"
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">RSS Memory</span>
              <span className="text-foreground">{metrics?.memory.rssMB ?? 0} MB</span>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
            Uptime
          </h3>
          <p className="text-2xl font-bold text-foreground">
            {metrics?.uptime.formatted ?? "-"}
          </p>
          <p className="text-xs text-muted">since last restart</p>
        </div>

        {/* Alerts */}
        {hasAlerts && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-yellow-500 uppercase tracking-wide mb-2">
              Alerts
            </h3>
            <ul className="space-y-1">
              {metrics?.alerts.map((alert, i) => (
                <li key={i} className="text-sm text-yellow-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {alert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Version Info */}
        <div className="text-center text-xs text-muted pt-4">
          <p>API Version: {health?.version ?? "-"}</p>
          <p className="mt-1">Auto-refreshes every 30 seconds</p>
        </div>
      </div>
    </div>
  );
}
