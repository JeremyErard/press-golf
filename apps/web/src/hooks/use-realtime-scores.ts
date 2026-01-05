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
}

export function useRealtimeScores(
  options: UseRealtimeScoresOptions
): UseRealtimeScoresReturn {
  const { roundId, enabled = true, onScoreUpdate, onPlayerJoined, onRoundCompleted } = options;
  const { getToken } = useAuth();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastUpdate, setLastUpdate] = useState<RealtimeScoreUpdate | null>(null);

  const clientRef = useRef<SSEClient | null>(null);
  const callbacksRef = useRef({ onScoreUpdate, onPlayerJoined, onRoundCompleted });

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
        break;

      case "ping":
        // Keep-alive ping - no action needed
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

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.resetReconnects();
      clientRef.current.disconnect();
    }
    connect();
  }, [connect]);

  return {
    connectionStatus,
    lastUpdate,
    reconnect,
  };
}
