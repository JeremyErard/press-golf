/**
 * SSE Client for real-time score updates
 *
 * This is a simple transport layer that manages the EventSource connection.
 * It does NOT handle reconnection - that responsibility belongs to the hook
 * which can get fresh auth tokens on each reconnection attempt.
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
}

export class SSEClient {
    private eventSource: EventSource | null = null;
    private isDestroyed = false;

  private readonly roundId: string;
    private readonly token: string;
    private readonly onEvent: (event: SSEEvent) => void;
    private readonly onStatusChange: (status: ConnectionStatus) => void;

  constructor(options: SSEClientOptions) {
        this.roundId = options.roundId;
        this.token = options.token;
        this.onEvent = options.onEvent;
        this.onStatusChange = options.onStatusChange;
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

          // On error, report status and let the hook handle reconnection
          this.eventSource.onerror = (error) => {
                    console.error("SSE connection error:", error);
                    this.onStatusChange("error");
                    // Don't reconnect here - the hook will handle it with a fresh token
          };
      } catch (error) {
              console.error("Failed to create EventSource:", error);
              this.onStatusChange("error");
      }
  }

  private cleanup(): void {
        if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
        }
  }

  disconnect(): void {
        this.isDestroyed = true;
        this.cleanup();
        this.onStatusChange("disconnected");
  }

  isConnected(): boolean {
        return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Factory function for creating SSE client
export function createSSEClient(options: SSEClientOptions): SSEClient {
    return new SSEClient(options);
}
