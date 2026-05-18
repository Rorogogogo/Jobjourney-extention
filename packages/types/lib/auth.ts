// Authentication types

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isPro?: boolean;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: AuthUser;
  token?: string;
  expiresAt?: number;
}
