"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  SSEClient,
  createSSEClient,
  type SSEEvent,
  type ConnectionStatus,
  type ScoreUpdatedEvent,
  type PlayerJoinedEvent,
} from "@/lib/sse-client";

export interface RealtimeScoreUpdate {
  userId: string;
  holeNumber: number;
  strokes: number | null;
  timestamp: number;
}

export interface RealtimePlayerJoined {
  userId: string;
  displayName: string | null;
  timestamp: number;
}

export interface UseRealtimeScoresOptions {
  roundId: string;
  enabled?: boolean;
  onScoreUpdate?: (update: RealtimeScoreUpdate) => void;
  onPlayerJoined?: (player: RealtimePlayerJoined) => void;
  onRoundCompleted?: () => void;
}

export interface UseRealtimeScoresReturn {
  connectionStatus: ConnectionStatus;
  lastUpdate: RealtimeScoreUpdate | null;
  reconnect: () => void;
  lastPingTime: number | null;
}

// Heartbeat timeout - if no ping received in this time, connection is considered stale
const HEARTBEAT_TIMEOUT_MS = 75000; // 75 seconds (2.5 missed 30s pings)

// Reconnection settings
const INITIAL_RECONNECT_DELAY_MS = 1000; // Start with 1 second
const MAX_RECONNECT_DELAY_MS = 30000; // Max 30 seconds
const MAX_RECONNECT_ATTEMPTS = 20; // Give up after 20 attempts (~5 minutes with backoff)

export function useRealtimeScores(
  options: UseRealtimeScoresOptions
): UseRealtimeScoresReturn {
  const { roundId, enabled = true, onScoreUpdate, onPlayerJoined, onRoundCompleted } = options;
  const { getToken } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastUpdate, setLastUpdate] = useState<RealtimeScoreUpdate | null>(null);
  const [lastPingTime, setLastPingTime] = useState<number | null>(null);

  const clientRef = useRef<SSEClient | null>(null);
  const callbacksRef = useRef({ onScoreUpdate, onPlayerJoined, onRoundCompleted });
  const heartbeatCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  // Keep callbacks up to date
  useEffect(() => {
    callbacksRef.current = { onScoreUpdate, onPlayerJoined, onRoundCompleted };
  }, [onScoreUpdate, onPlayerJoined, onRoundCompleted]);

  // Clear any pending reconnect timer
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const handleEvent = useCallback((event: SSEEvent) => {
    const callbacks = callbacksRef.current;

    switch (event.type) {
      case "score_updated": {
        const { data } = event as ScoreUpdatedEvent;
        const update: RealtimeScoreUpdate = {
          ...data,
          timestamp: Date.now(),
        };
        setLastUpdate(update);
        callbacks.onScoreUpdate?.(update);
        break;
      }

      case "player_joined": {
        const { data } = event as PlayerJoinedEvent;
        const player: RealtimePlayerJoined = {
          ...data,
          timestamp: Date.now(),
        };
        callbacks.onPlayerJoined?.(player);
        break;
      }

      case "round_completed": {
        callbacks.onRoundCompleted?.();
        break;
      }

      case "connected":
        console.log("SSE connected to round:", (event as { data: { roundId: string } }).data.roundId);
        setLastPingTime(Date.now()); // Initial connection counts as heartbeat
        // Reset reconnect attempts on successful connection
        reconnectAttemptsRef.current = 0;
        break;

      case "ping":
        // Update last ping time for heartbeat monitoring
        setLastPingTime(Date.now());
        break;
    }
  }, []);

  // Core connect function - gets fresh token and creates new client
  const connect = useCallback(async () => {
    if (!enabled || !roundId) return;
    if (isConnectingRef.current) return; // Prevent concurrent connection attempts

    isConnectingRef.current = true;

    try {
      // Always get a fresh token - this is the key fix!
      const token = await getToken();
      if (!token) {
        console.warn("No auth token available for SSE connection");
        setConnectionStatus("error");
        isConnectingRef.current = false;
        return;
      }

      // Clean up existing client
      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      // Create new client with fresh token
      const client = createSSEClient({
        roundId,
        token,
        onEvent: handleEvent,
        onStatusChange: (status) => {
          setConnectionStatus(status);

          // Handle error status - schedule reconnection
          if (status === "error") {
            scheduleReconnect();
          }
        },
      });

      clientRef.current = client;
      client.connect();
    } catch (error) {
      console.error("Failed to establish SSE connection:", error);
      setConnectionStatus("error");
      scheduleReconnect();
    } finally {
      isConnectingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roundId, getToken, handleEvent]);

  // Schedule a reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    clearReconnectTimer();

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn("Max reconnect attempts reached - giving up");
      setConnectionStatus("disconnected");
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttemptsRef.current - 1),
      MAX_RECONNECT_DELAY_MS
    );

    console.log(`Scheduling SSE reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [clearReconnectTimer, connect]);

  // Manual reconnect function - resets attempt counter
  const reconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;

    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    setLastPingTime(null);
    connect();
  }, [clearReconnectTimer, connect]);

  // Connect on mount / when roundId changes
  useEffect(() => {
    connect();

    return () => {
      clearReconnectTimer();
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [connect, clearReconnectTimer]);

  // Heartbeat monitoring - detect stale connections
  useEffect(() => {
    if (!enabled) return;

    heartbeatCheckRef.current = setInterval(() => {
      if (lastPingTime && connectionStatus === "connected") {
        const timeSinceLastPing = Date.now() - lastPingTime;
        if (timeSinceLastPing > HEARTBEAT_TIMEOUT_MS) {
          console.warn("SSE heartbeat timeout - reconnecting with fresh token...");
          reconnect();
        }
      }
    }, 30000); // Check every 30 seconds (matches server ping interval)

    return () => {
      if (heartbeatCheckRef.current) {
        clearInterval(heartbeatCheckRef.current);
      }
    };
  }, [enabled, lastPingTime, connectionStatus, reconnect]);

  // Visibility change detection - reconnect when user returns to tab
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // User returned to tab - check if we need to reconnect
        if (connectionStatus === "disconnected" || connectionStatus === "error") {
          console.log("Tab became visible - reconnecting SSE with fresh token...");
          reconnect();
        } else if (lastPingTime) {
          // Check if connection might be stale
          const timeSinceLastPing = Date.now() - lastPingTime;
          if (timeSinceLastPing > HEARTBEAT_TIMEOUT_MS) {
            console.log("Tab became visible - connection stale, reconnecting with fresh token...");
            reconnect();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, connectionStatus, lastPingTime, reconnect]);

  return {
    connectionStatus,
    lastUpdate,
    reconnect,
    lastPingTime,
  };
}
