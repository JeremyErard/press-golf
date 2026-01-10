/**
 * SSE Client for real-time score updates
 * Handles connection, reconnection, and event parsing
 */

// Use production API URL as fallback (same as api.ts)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://press-api.onrender.com/api";

export type SSEEventType =
  | "score_updated"
  | "game_updated"
  | "player_joined"
  | "round_completed"
  | "connected"
  | "ping";

export interface ScoreUpdatedEvent {
  type: "score_updated";
  data: {
    userId: string;
    holeNumber: number;
    strokes: number | null;
  };
}

export interface GameUpdatedEvent {
  type: "game_updated";
  data: {
    gameId: string;
    changes: Record<string, unknown>;
  };
}

export interface PlayerJoinedEvent {
  type: "player_joined";
  data: {
    userId: string;
    displayName: string | null;
  };
}

export interface RoundCompletedEvent {
  type: "round_completed";
  data: {
    roundId: string;
  };
}

export interface ConnectedEvent {
  type: "connected";
  data: {
    roundId: string;
  };
}

export interface PingEvent {
  type: "ping";
  data: {
    timestamp: number;
  };
}

export type SSEEvent =
  | ScoreUpdatedEvent
  | GameUpdatedEvent
  | PlayerJoinedEvent
  | RoundCompletedEvent
  | ConnectedEvent
  | PingEvent;

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface SSEClientOptions {
  roundId: string;
  token: string;
  onEvent: (event: SSEEvent) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isDestroyed = false;

  private readonly roundId: string;
  private readonly token: string;
  private readonly onEvent: (event: SSEEvent) => void;
  private readonly onStatusChange: (status: ConnectionStatus) => void;
  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;

  constructor(options: SSEClientOptions) {
    this.roundId = options.roundId;
    this.token = options.token;
    this.onEvent = options.onEvent;
    this.onStatusChange = options.onStatusChange;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
  }

  connect(): void {
    if (this.isDestroyed) return;

    this.cleanup();
    this.onStatusChange("connecting");

    // Build URL with auth token as query param (SSE doesn't support headers)
    const url = new URL(`${API_URL}/realtime/rounds/${this.roundId}/live`);
    url.searchParams.set("token", this.token);

    try {
      this.eventSource = new EventSource(url.toString());

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.onStatusChange("connected");
      };

      // Handler for parsing events
      const parseEvent = (event: MessageEvent, type?: SSEEventType) => {
        try {
          const parsed = JSON.parse(event.data);
          // If type is provided (named event), use it; otherwise get from data
          const eventType = type || parsed.type;
          this.onEvent({ ...parsed, type: eventType } as SSEEvent);
        } catch (error) {
          console.error("Failed to parse SSE event:", error, event.data);
        }
      };

      // Listen for unnamed events (fallback)
      this.eventSource.onmessage = (event) => parseEvent(event);

      // Listen for named events (SSE sends these with "event: type")
      const eventTypes: SSEEventType[] = [
        "score_updated",
        "game_updated",
        "player_joined",
        "round_completed",
        "connected",
        "ping",
      ];

      eventTypes.forEach((eventType) => {
        this.eventSource!.addEventListener(eventType, (event) => {
          parseEvent(event as MessageEvent, eventType);
        });
      });

      this.eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        this.onStatusChange("error");
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      this.onStatusChange("error");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;

    this.cleanup();

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("Max reconnect attempts reached");
      this.onStatusChange("disconnected");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.onStatusChange("connecting");

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.onStatusChange("disconnected");
  }

  // Reset reconnection attempts (useful when manually reconnecting)
  resetReconnects(): void {
    this.reconnectAttempts = 0;
  }
}

// Factory function for creating SSE client
export function createSSEClient(options: SSEClientOptions): SSEClient {
  return new SSEClient(options);
}
