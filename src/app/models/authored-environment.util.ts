/**
 * Helpers for authored-environment rows and their flat bird's-eye capture folder keys.
 * Keep in sync with the Unity export: folder `authored_environment_<authoringId>`, with
 * characters Windows rejects in file names replaced by `_`.
 */

/** Matches Path.GetInvalidFileNameChars() on Windows, which Unity replaces with `_`. */
const INVALID_FOLDER_CHARS = /["<>|:*?\\/\u0000-\u001f]/g;

/** Flat capture-folder key for an authored environment's bird's-eye export. */
export function authoredEnvironmentBirdsEyeKey(
  authoringId: string | null | undefined,
): string {
  const id = (authoringId ?? '').trim();
  return id ? `authored_environment_${id}`.replace(INVALID_FOLDER_CHARS, '_') : '';
}
