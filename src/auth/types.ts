export interface UserRecord {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  kickUsername: string;
  kickChatroomId: number;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email?: string;
  kickUsername: string;
  kickChatroomId: number;
  createdAt: string;
}

export interface SignupInput {
  username: string;
  password: string;
  email?: string;
  kickUsername: string;
  kickChatroomId: number;
}

export interface LoginInput {
  username: string;
  password: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    kickUsername: user.kickUsername,
    kickChatroomId: user.kickChatroomId,
    createdAt: user.createdAt,
  };
}
