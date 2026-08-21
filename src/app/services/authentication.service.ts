import { Injectable, inject, signal, computed } from '@angular/core';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../environment';
import { AssetMetaAuthor } from '../models/asset-meta.models';

const LOCAL_DEV_AUTHOR: AssetMetaAuthor = {
  sub: 'local-dev',
  name: 'Local Dev',
};

/**
 * Thin Auth0 wrapper. When environment.authEnabled is false, Auth0 is never
 * injected (AuthService is providedIn root and needs provideAuth0()).
 * Local mode treats the session as editable with a local-dev identity.
 */
@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  /**
   * Only inject Auth0 when enabled. Optional inject still constructs AuthService
   * (providedIn: 'root'), which then fails without auth0.client.
   */
  private readonly auth0 = environment.authEnabled
    ? inject(Auth0Service)
    : null;

  readonly authConfigured = environment.authEnabled && !!this.auth0;

  private readonly auth0Authenticated = this.auth0
    ? toSignal(
        this.auth0.isAuthenticated$.pipe(catchError(() => of(false))),
        { initialValue: false },
      )
    : signal(false);

  private readonly auth0User = this.auth0
    ? toSignal(
        this.auth0.user$.pipe(catchError(() => of(null as User | null))),
        { initialValue: null as User | null | undefined },
      )
    : signal<User | null | undefined>(null);

  readonly isAuthenticated = computed(() => {
    if (!this.authConfigured) {
      // Local / no Auth0: allow edits with the local-dev identity.
      return true;
    }
    return !!this.auth0Authenticated();
  });

  readonly currentUser = computed(() => {
    if (!this.authConfigured) return null;
    return this.auth0User() ?? null;
  });

  readonly displayName = computed(() => {
    if (!this.authConfigured) return LOCAL_DEV_AUTHOR.name ?? 'Local Dev';
    const u = this.currentUser();
    return u?.name || u?.nickname || u?.email || 'User';
  });

  readonly picture = computed(() => {
    if (!this.authConfigured) return null;
    return this.currentUser()?.picture ?? null;
  });

  requestLogin(): void {
    if (!this.auth0 || !environment.authEnabled) {
      console.warn(
        'Auth0 is not enabled. Set environment.authEnabled / window.__ASSET_VIEWER_CONFIG__ and Auth0 callbacks for localhost:4300.',
      );
      return;
    }
    this.auth0.loginWithRedirect();
  }

  requestLogout(): void {
    if (!this.auth0 || !environment.authEnabled) return;
    this.auth0.logout({
      logoutParams: { returnTo: window.location.origin },
    });
  }

  /** Identity stamped onto comments / updatedBy. */
  author(): AssetMetaAuthor {
    if (!this.authConfigured) return { ...LOCAL_DEV_AUTHOR };
    const u = this.currentUser();
    if (!u?.sub) return { ...LOCAL_DEV_AUTHOR };
    return {
      sub: u.sub,
      name: u.name || u.nickname || undefined,
      email: u.email || undefined,
    };
  }
}
