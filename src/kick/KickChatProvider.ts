import { KickWebSocket } from "kick-wss";
import type { ChatMessageEvent } from "kick-wss";
import type { ChatProvider, ChatMessage } from "../types.js";
import { mapKickMessage } from "./mapKickMessage.js";
import { PusherKickChat } from "./pusherKickChat.js";

export interface KickChatProviderOptions {
  channel: string;
  chatroomId?: number;
  debug?: boolean;
}

export class KickChatProvider implements ChatProvider {
  private readonly listeners = new Set<(message: ChatMessage) => void>();
  private readonly pusherChat?: PusherKickChat;
  private readonly slugChat?: KickWebSocket;
  private chatHandler?: (event: ChatMessageEvent) => void;
  private unsubscribePusher?: () => void;

  constructor(private readonly options: KickChatProviderOptions) {
    if (options.chatroomId !== undefined) {
      this.pusherChat = new PusherKickChat({
        chatroomId: options.chatroomId,
        debug: options.debug,
      });
      return;
    }

    this.slugChat = new KickWebSocket({
      debug: options.debug ?? false,
      filteredEvents: ["ChatMessage"],
    });
  }

  async connect(): Promise<void> {
    if (this.pusherChat) {
      await this.pusherChat.connect();
      this.unsubscribePusher = this.pusherChat.onChatMessage((event) => {
        this.emit(mapKickMessage(event));
      });
      return;
    }

    if (!this.slugChat) {
      throw new Error("Kick chat provider is not configured");
    }

    await this.slugChat.connect(this.options.channel);

    this.chatHandler = (event: ChatMessageEvent) => {
      this.emit(mapKickMessage(event));
    };

    this.slugChat.on("ChatMessage", this.chatHandler);
  }

  async disconnect(): Promise<void> {
    this.unsubscribePusher?.();
    this.unsubscribePusher = undefined;

    if (this.slugChat && this.chatHandler) {
      this.slugChat.off("ChatMessage", this.chatHandler);
      this.chatHandler = undefined;
      this.slugChat.disconnect();
    }

    this.pusherChat?.disconnect();
  }

  onMessage(callback: (message: ChatMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  isConnected(): boolean {
    if (this.pusherChat) {
      return this.pusherChat.isConnected();
    }

    return this.slugChat?.isConnected() ?? false;
  }

  getChannelName(): string {
    return this.options.channel;
  }

  private emit(message: ChatMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}
