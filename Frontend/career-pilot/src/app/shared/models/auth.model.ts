export interface AuthResponse {
  token: string;
  email: string;
  expiresAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
