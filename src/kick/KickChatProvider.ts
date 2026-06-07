import { KickWebSocket } from "kick-wss";
import type { ChatMessageEvent } from "kick-wss";
import type { ChatProvider, ChatMessage } from "../types.js";
import { mapKickMessage } from "./mapKickMessage.js";

export interface KickChatProviderOptions {
  channel: string;
  debug?: boolean;
}

export class KickChatProvider implements ChatProvider {
  private readonly ws: KickWebSocket;
  private readonly listeners = new Set<(message: ChatMessage) => void>();
  private chatHandler?: (event: ChatMessageEvent) => void;

  constructor(private readonly options: KickChatProviderOptions) {
    this.ws = new KickWebSocket({
      debug: options.debug ?? false,
      filteredEvents: ["ChatMessage"],
    });
  }

  async connect(): Promise<void> {
    await this.ws.connect(this.options.channel);

    this.chatHandler = (event: ChatMessageEvent) => {
      const message = mapKickMessage(event);
      for (const listener of this.listeners) {
        listener(message);
      }
    };

    this.ws.on("ChatMessage", this.chatHandler);
  }

  async disconnect(): Promise<void> {
    if (this.chatHandler) {
      this.ws.off("ChatMessage", this.chatHandler);
      this.chatHandler = undefined;
    }

    this.ws.disconnect();
  }

  onMessage(callback: (message: ChatMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  isConnected(): boolean {
    return this.ws.isConnected();
  }

  getChannelName(): string {
    return this.ws.getChannelName();
  }
}
