import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { from, switchMap, catchError } from 'rxjs';
import { environment } from './environment';

/**
 * Attach Bearer token to API calls when Auth0 is enabled.
 * Falls through without a token when silent get fails (public GETs still work).
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  // Never touch Auth0 DI when disabled — AuthService is providedIn:root and
  // requires provideAuth0() / auth0.client.
  if (!environment.authEnabled) {
    return next(req);
  }
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  let auth0: Auth0Service | null = null;
  try {
    auth0 = inject(Auth0Service);
  } catch {
    return next(req);
  }

  return from(auth0.getAccessTokenSilently()).pipe(
    switchMap((token) =>
      next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        }),
      ),
    ),
    catchError(() => next(req)),
  );
};
