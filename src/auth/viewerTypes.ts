export interface ViewerRecord {
  id: string;
  kickUsername: string;
  kickChatroomId: number;
  kickUserId?: number;
  kickAccessToken?: string;
  kickRefreshToken?: string;
  kickTokenExpiresAt?: string;
  email?: string;
  passwordHash: string;
  createdAt: string;
}

export interface PublicViewer {
  id: string;
  kickUsername: string;
  kickChatroomId: number;
  email?: string;
  createdAt: string;
}

export interface ViewerSignupInput {
  kickUsername: string;
  password: string;
  email?: string;
  kickChatroomId?: number;
  kickUserId?: number;
  kickAccessToken?: string;
  kickRefreshToken?: string;
  kickTokenExpiresAt?: string;
}

export interface ViewerLoginInput {
  kickUsername: string;
  password: string;
}

export function toPublicViewer(viewer: ViewerRecord): PublicViewer {
  return {
    id: viewer.id,
    kickUsername: viewer.kickUsername,
    kickChatroomId: viewer.kickChatroomId,
    email: viewer.email,
    createdAt: viewer.createdAt,
  };
}
