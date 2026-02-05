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

  // Keep callbacks up to date
  useEffect(() => {
        callbacksRef.current = { onScoreUpdate, onPlayerJoined, onRoundCompleted };
  }, [onScoreUpdate, onPlayerJoined, onRoundCompleted]);

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
            break;

                                        case "ping":
                                                  // Update last ping time for heartbeat monitoring
            setLastPingTime(Date.now());
                                                  break;
                                      }
  }, []);

  const connect = useCallback(async () => {
        if (!enabled || !roundId) return;

                                  try {
                                          const token = await getToken();
                                          if (!token) {
                                                    console.warn("No auth token available for SSE connection");
                                                    setConnectionStatus("error");
                                                    return;
                                          }

          // Clean up existing client
          if (clientRef.current) {
                    clientRef.current.disconnect();
          }

          // Create new client
          const client = createSSEClient({
                    roundId,
                    token,
                    onEvent: handleEvent,
                    onStatusChange: setConnectionStatus,
          });

          clientRef.current = client;
                                          client.connect();
                                  } catch (error) {
                                          console.error("Failed to establish SSE connection:", error);
                                          setConnectionStatus("error");
                                  }
  }, [enabled, roundId, getToken, handleEvent]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
        if (clientRef.current) {
                clientRef.current.resetReconnects();
                clientRef.current.disconnect();
        }
        setLastPingTime(null);
        connect();
  }, [connect]);

  // Connect on mount / when roundId changes
  useEffect(() => {
        connect();

                return () => {
                        if (clientRef.current) {
                                  clientRef.current.disconnect();
                                  clientRef.current = null;
                        }
                };
  }, [connect]);

  // Heartbeat monitoring - detect stale connections
  useEffect(() => {
        if (!enabled) return;

                heartbeatCheckRef.current = setInterval(() => {
                        if (lastPingTime && connectionStatus === "connected") {
                                  const timeSinceLastPing = Date.now() - lastPingTime;
                                  if (timeSinceLastPing > HEARTBEAT_TIMEOUT_MS) {
                                              console.warn("SSE heartbeat timeout - reconnecting...");
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
                                      console.log("Tab became visible - reconnecting SSE...");
                                      reconnect();
                          } else if (lastPingTime) {
                                      // Check if connection might be stale
                                    const timeSinceLastPing = Date.now() - lastPingTime;
                                      if (timeSinceLastPing > HEARTBEAT_TIMEOUT_MS) {
                                                    console.log("Tab became visible - connection stale, reconnecting...");
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
