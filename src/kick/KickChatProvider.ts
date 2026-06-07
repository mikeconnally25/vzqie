import type { ChatMessage, ChatProvider } from "../types.js";
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
  private unsubscribePusher?: () => void;

  constructor(private readonly options: KickChatProviderOptions) {
    if (options.chatroomId !== undefined) {
      this.pusherChat = new PusherKickChat({
        chatroomId: options.chatroomId,
        debug: options.debug,
      });
    }
  }

  async connect(): Promise<void> {
    if (!this.pusherChat) {
      throw new Error("KICK_CHATROOM_ID is required to connect Kick chat.");
    }

    await this.pusherChat.connect();
    this.unsubscribePusher = this.pusherChat.onChatMessage((event) => {
      this.emit(mapKickMessage(event));
    });
  }

  async disconnect(): Promise<void> {
    this.unsubscribePusher?.();
    this.unsubscribePusher = undefined;
    this.pusherChat?.disconnect();
  }

  onMessage(callback: (message: ChatMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  isConnected(): boolean {
    return this.pusherChat?.isConnected() ?? false;
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
