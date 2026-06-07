import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CreateUserInput, UserRecord } from "./types.js";
import { normalizeKickSlug } from "../kick/kickChannelLookup.js";
import { normalizeUsername } from "../utils.js";

interface UserDatabase {
  users: UserRecord[];
}

export class UserStore {
  private readonly filePath: string;
  private cache: UserDatabase | null = null;

  constructor(dataDir = path.join(process.cwd(), "data")) {
    this.filePath = path.join(dataDir, "users.json");
  }

  async createUser(input: CreateUserInput, passwordHash: string): Promise<UserRecord> {
    const db = await this.load();
    const normalized = normalizeUsername(input.username);

    if (
      db.users.some(
        (user) => normalizeUsername(user.username) === normalized
      )
    ) {
      throw new Error("Username is already taken.");
    }

    const email = input.email?.trim().toLowerCase();
    if (email && db.users.some((user) => user.email?.toLowerCase() === email)) {
      throw new Error("Email is already registered.");
    }

    const kickSlug = normalizeKickSlug(input.kickUsername);
    if (
      db.users.some(
        (user) => normalizeKickSlug(user.kickUsername) === kickSlug
      )
    ) {
      throw new Error("This Kick account is already linked to another user.");
    }

    if (db.users.some((user) => user.kickChatroomId === input.kickChatroomId)) {
      throw new Error("This Kick chatroom is already linked to another user.");
    }

    const user: UserRecord = {
      id: randomUUID(),
      username: input.username.trim(),
      email: email || undefined,
      passwordHash,
      kickUsername: kickSlug,
      kickChatroomId: input.kickChatroomId,
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    await this.save(db);
    return user;
  }

  async findByUsername(username: string): Promise<UserRecord | undefined> {
    const db = await this.load();
    const normalized = normalizeUsername(username);
    return db.users.find(
      (user) => normalizeUsername(user.username) === normalized
    );
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const db = await this.load();
    return db.users.find((user) => user.id === id);
  }

  async count(): Promise<number> {
    const db = await this.load();
    return db.users.length;
  }

  private async load(): Promise<UserDatabase> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.cache = JSON.parse(raw) as UserDatabase;
      return this.cache;
    } catch {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      this.cache = { users: [] };
      await this.save(this.cache);
      return this.cache;
    }
  }

  private async save(db: UserDatabase): Promise<void> {
    this.cache = db;
    await writeFile(this.filePath, JSON.stringify(db, null, 2), "utf8");
  }
}
