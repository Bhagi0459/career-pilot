import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../../shared/models';

interface StoredAuth {
  token: string;
  email: string;
  expiresAt: string;
}

const STORAGE_KEY = 'careerpilot.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly auth = signal<StoredAuth | null>(readFromStorage());

  readonly currentUserEmail = computed(() => this.auth()?.email ?? null);

  readonly isAuthenticated = computed(() => {
    const value = this.auth();
    return value !== null && new Date(value.expiresAt).getTime() > Date.now();
  });

  get token(): string | null {
    return this.auth()?.token ?? null;
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(tap((response) => this.setAuth(response)));
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

  private setAuth(response: AuthResponse): void {
    const stored: StoredAuth = { token: response.token, email: response.email, expiresAt: response.expiresAt };
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
