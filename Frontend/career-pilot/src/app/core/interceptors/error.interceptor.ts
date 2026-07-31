import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// A 401 from any of these means the credentials/refresh token themselves were rejected - there's
// nothing to refresh, so it goes straight to logout instead of trying to refresh first.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh'];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !authService.isAuthenticated()) {
        return throwError(() => error);
      }

      if (isAuthEndpoint) {
        authService.logout();
        void router.navigate(['/login']);
        return throwError(() => error);
      }

      // Any other 401 means the (short-lived) access token expired or was otherwise rejected -
      // the expected, routine case. Try one silent refresh and retry the original request with
      // the new token; only a failed refresh (expired/revoked/stolen refresh token) is a real
      // logout.
      return authService.refreshAccessToken().pipe(
        switchMap((response) => next(req.clone({ setHeaders: { Authorization: `Bearer ${response.token}` } }))),
        catchError(() => {
          authService.logout();
          void router.navigate(['/login']);
          return throwError(() => error);
        })
      );
    })
  );
};
