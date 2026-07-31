import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest } from '../../shared/models';

interface StoredAuth {
  token: string;
  email: string;
  displayName: string;
  expiresAt: string;
}

const STORAGE_KEY = 'careerpilot.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly auth = signal<StoredAuth | null>(readFromStorage());

  readonly currentUserEmail = computed(() => this.auth()?.email ?? null);
  readonly currentUserDisplayName = computed(() => this.auth()?.displayName ?? null);

  readonly isAuthenticated = computed(() => {
    const value = this.auth();
    return value !== null && new Date(value.expiresAt).getTime() > Date.now();
  });

  get token(): string | null {
    return this.auth()?.token ?? null;
  }

  // Deliberately doesn't auto-authenticate like login() does - a fresh registration should
  // land the user on the login page with a confirmation, not skip straight past it.
  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, request);
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap((response) => this.setAuth(response)));
  }

  logout(): void {
    this.auth.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/reset-password`, request);
  }

  /** Reflects a profile edit into the locally cached session without requiring a re-login. */
  updateDisplayName(displayName: string): void {
    const current = this.auth();
    if (!current) {
      return;
    }
    const updated: StoredAuth = { ...current, displayName };
    this.auth.set(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  private setAuth(response: AuthResponse): void {
    const stored: StoredAuth = {
      token: response.token,
      email: response.email,
      displayName: response.displayName,
      expiresAt: response.expiresAt
    };
    this.auth.set(stored);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
}

function readFromStorage(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}
