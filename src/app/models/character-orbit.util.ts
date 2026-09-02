/**
 * Orbit-capture folder keys for character / body-texture / overlay rows.
 * Keep in sync with Unity `CharacterGlbCaptureKeys`.
 */

export function bodyTextureOrbitCaptureKey(guid: string | null | undefined): string {
  const id = guid?.trim();
  return id ? `body_texture_${id}` : '';
}

export function overlayTextureOrbitCaptureKey(guid: string | null | undefined): string {
  const id = guid?.trim();
  return id ? `overlay_texture_${id}` : '';
}
