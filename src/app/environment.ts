/**
 * Runtime config for the asset viewer.
 * Override Auth0 via window.__ASSET_VIEWER_CONFIG__ before bootstrap if needed.
 */

export interface AssetViewerConfig {
  production: boolean;
  apiBaseUrl: string;
  auth0Domain: string;
  auth0ClientId: string;
  auth0Audience: string;
  /** When false, Auth0 is not initialized (static / GitHub Pages demos). */
  authEnabled: boolean;
}

declare global {
  interface Window {
    __ASSET_VIEWER_CONFIG__?: Partial<AssetViewerConfig>;
  }
}

const defaults: AssetViewerConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:4301',
  // Same Auth0 tenant as legacy asset-database; add http://localhost:4300
  // to Allowed Callback / Logout / Web Origins before enabling locally.
  auth0Domain: 'simx.us.auth0.com',
  auth0ClientId: '3BaatB5dKlm3zE4sEzZjVDqgVUIBHu8o',
  auth0Audience: 'https://asset-database-api.simx-infra.com',
  // Opt-in: set true (or window override) once Auth0 callbacks include this origin.
  // When false, login UI still shows but uses a local-dev identity for writes.
  authEnabled: false,
};

export const environment: AssetViewerConfig = {
  ...defaults,
  ...(typeof window !== 'undefined' ? window.__ASSET_VIEWER_CONFIG__ ?? {} : {}),
};
