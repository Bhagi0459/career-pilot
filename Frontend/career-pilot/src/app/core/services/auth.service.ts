import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest } from '../../shared/models';

interface StoredAuth {
  token: string;
  refreshToken: string;
  email: string;
  displayName: string;
  expiresAt: string;
}

const STORAGE_KEY = 'careerpilot.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly auth = signal<StoredAuth | null>(readFromStorage());

  // Deduplicates concurrent refresh attempts - if several requests 401 around the same moment,
  // they share this single in-flight refresh instead of each rotating the refresh token
  // themselves, which would otherwise invalidate one another mid-flight.
  private refreshInProgress$: Observable<AuthResponse> | null = null;

  readonly currentUserEmail = computed(() => this.auth()?.email ?? null);
  readonly currentUserDisplayName = computed(() => this.auth()?.displayName ?? null);

  // A stored session is enough to treat the user as authenticated for routing purposes - the
  // access token expiring on its own isn't a logout signal, since the HTTP layer transparently
  // refreshes it (see error.interceptor.ts). Only a failed refresh (invalid/expired/revoked
  // refresh token) actually ends the session.
  readonly isAuthenticated = computed(() => this.auth() !== null);

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

  // Exchanges the stored refresh token for a new access token, rotating the refresh token in
  // the same call. Called by error.interceptor.ts on a 401, not on any fixed timer - the access
  // token is short-lived, so refreshing reactively (only when actually needed) avoids running a
  // background timer for the whole time the app is open.
  refreshAccessToken(): Observable<AuthResponse> {
    if (this.refreshInProgress$) {
      return this.refreshInProgress$;
    }

    const refreshToken = this.auth()?.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    this.refreshInProgress$ = this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      tap((response) => this.setAuth(response)),
      finalize(() => {
        this.refreshInProgress$ = null;
      }),
      // Without this, each concurrent subscriber (one per interceptor call) would re-trigger
      // its own HTTP request against this cold Observable instead of sharing the one already in
      // flight - shareReplay(1) makes it hot/multicast so they all get the same single response.
      shareReplay(1)
    );

    return this.refreshInProgress$;
  }

  logout(): void {
    const refreshToken = this.auth()?.refreshToken;
    this.auth.set(null);
    localStorage.removeItem(STORAGE_KEY);

    // Best-effort revocation - the local session is already cleared above regardless of whether
    // this reaches the server, so the user never waits on it or sees it fail.
    if (refreshToken) {
      this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken }).subscribe({ error: () => undefined });
    }
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
      refreshToken: response.refreshToken,
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
