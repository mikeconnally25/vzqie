import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ViewerRecord } from "./viewerTypes.js";
import { normalizeKickSlug } from "../kick/kickChannelLookup.js";

interface ViewerDatabase {
  viewers: ViewerRecord[];
}

export interface CreateViewerInput {
  kickUsername: string;
  kickChatroomId: number;
  kickUserId?: number;
  kickAccessToken?: string;
  kickRefreshToken?: string;
  kickTokenExpiresAt?: string;
  email?: string;
}

export class ViewerStore {
  private readonly filePath: string;
  private cache: ViewerDatabase | null = null;

  constructor(dataDir = path.join(process.cwd(), "data")) {
    this.filePath = path.join(dataDir, "viewers.json");
  }

  async createViewer(
    input: CreateViewerInput,
    passwordHash: string
  ): Promise<ViewerRecord> {
    const db = await this.load();
    const kickSlug = normalizeKickSlug(input.kickUsername);

    if (
      db.viewers.some(
        (viewer) => normalizeKickSlug(viewer.kickUsername) === kickSlug
      )
    ) {
      throw new Error("This Kick account is already registered.");
    }

    if (
      db.viewers.some((viewer) => viewer.kickChatroomId === input.kickChatroomId)
    ) {
      throw new Error("This Kick chatroom is already linked to another viewer.");
    }

    if (
      input.kickUserId !== undefined &&
      db.viewers.some((viewer) => viewer.kickUserId === input.kickUserId)
    ) {
      throw new Error("This Kick account is already registered.");
    }

    const email = input.email?.trim().toLowerCase();
    if (
      email &&
      db.viewers.some((viewer) => viewer.email?.toLowerCase() === email)
    ) {
      throw new Error("Email is already registered.");
    }

    const viewer: ViewerRecord = {
      id: randomUUID(),
      kickUsername: kickSlug,
      kickChatroomId: input.kickChatroomId,
      kickUserId: input.kickUserId,
      kickAccessToken: input.kickAccessToken,
      kickRefreshToken: input.kickRefreshToken,
      kickTokenExpiresAt: input.kickTokenExpiresAt,
      email: email || undefined,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    db.viewers.push(viewer);
    await this.save(db);
    return viewer;
  }

  async findByKickUsername(kickUsername: string): Promise<ViewerRecord | undefined> {
    const db = await this.load();
    const kickSlug = normalizeKickSlug(kickUsername);
    return db.viewers.find(
      (viewer) => normalizeKickSlug(viewer.kickUsername) === kickSlug
    );
  }

  async findById(id: string): Promise<ViewerRecord | undefined> {
    const db = await this.load();
    return db.viewers.find((viewer) => viewer.id === id);
  }

  async count(): Promise<number> {
    const db = await this.load();
    return db.viewers.length;
  }

  async listKickUsernames(): Promise<string[]> {
    const db = await this.load();
    return db.viewers.map((viewer) => normalizeKickSlug(viewer.kickUsername));
  }

  private async load(): Promise<ViewerDatabase> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.cache = JSON.parse(raw) as ViewerDatabase;
      return this.cache;
    } catch {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      this.cache = { viewers: [] };
      await this.save(this.cache);
      return this.cache;
    }
  }

  private async save(db: ViewerDatabase): Promise<void> {
    this.cache = db;
    await writeFile(this.filePath, JSON.stringify(db, null, 2), "utf8");
  }
}
