import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0 } from '@auth0/auth0-angular';

import { routes } from './app.routes';
import { environment } from './environment';
import { authTokenInterceptor } from './auth.interceptor';

const providers: ApplicationConfig['providers'] = [
  provideZoneChangeDetection({ eventCoalescing: true }),
  provideRouter(routes),
  provideHttpClient(withInterceptors([authTokenInterceptor])),
];

if (environment.authEnabled) {
  providers.push(
    provideAuth0({
      domain: environment.auth0Domain,
      clientId: environment.auth0ClientId,
      authorizationParams: {
        audience: environment.auth0Audience,
        redirect_uri: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
      httpInterceptor: {
        allowedList: [`${environment.apiBaseUrl}/*`],
      },
    }),
  );
}

export const appConfig: ApplicationConfig = { providers };
