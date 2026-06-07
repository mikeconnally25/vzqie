import WebSocket from "ws";
import type { KickChatMessageEvent } from "./mapKickMessage.js";

const PUSHER_URL =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false";
const CHAT_MESSAGE_EVENT = "App\\Events\\ChatMessageEvent";

export function parseKickChatFrame(raw: string): KickChatMessageEvent | null {
  let frame: { event?: string; data?: string };
  try {
    frame = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!frame.event || frame.event.startsWith("pusher:")) {
    return null;
  }

  if (frame.event !== CHAT_MESSAGE_EVENT || !frame.data) {
    return null;
  }

  try {
    return JSON.parse(frame.data) as KickChatMessageEvent;
  } catch {
    return null;
  }
}

export interface PusherKickChatOptions {
  chatroomId: number;
  debug?: boolean;
}

function subscriptionChannels(chatroomId: number): string[] {
  return [
    `chatroom_${chatroomId}`,
    `chatrooms.${chatroomId}.v2`,
    `channel_${chatroomId}`,
    `chatrooms.${chatroomId}`,
    `channel.${chatroomId}`,
    `predictions-channel-${chatroomId}`,
  ];
}

export class PusherKickChat {
  private ws?: WebSocket;
  private readonly listeners = new Set<(event: KickChatMessageEvent) => void>();
  private pingTimer?: ReturnType<typeof setInterval>;
  private closed = false;

  constructor(private readonly options: PusherKickChatOptions) {}

  async connect(): Promise<void> {
    if (this.ws) {
      return;
    }

    this.closed = false;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(PUSHER_URL);
      this.ws = ws;

      ws.on("open", () => {
        for (const channel of subscriptionChannels(this.options.chatroomId)) {
          ws.send(
            JSON.stringify({
              event: "pusher:subscribe",
              data: { auth: "", channel },
            })
          );
        }

        this.pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: "pusher:ping", data: "{}" }));
          }
        }, 30_000);

        if (this.options.debug) {
          console.log(
            `[PusherKickChat] Subscribed to chatroom ${this.options.chatroomId}`
          );
        }

        resolve();
      });

      ws.on("message", (data) => {
        this.handleRawMessage(data.toString());
      });

      ws.on("error", (error) => {
        if (ws.readyState === WebSocket.CONNECTING) {
          reject(error);
        } else if (this.options.debug) {
          console.error("[PusherKickChat] WebSocket error:", error);
        }
      });

      ws.on("close", () => {
        this.cleanupSocket();
      });
    });
  }

  disconnect(): void {
    this.closed = true;
    this.ws?.close(1000, "Manual disconnect");
    this.cleanupSocket();
  }

  onChatMessage(listener: (event: KickChatMessageEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private cleanupSocket(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    this.ws = undefined;
  }

  private handleRawMessage(raw: string): void {
    const payload = parseKickChatFrame(raw);
    if (!payload) {
      return;
    }

    for (const listener of this.listeners) {
      listener(payload);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
