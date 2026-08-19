/**
 * Helpers for custom-vessel rows and their flat orbit-capture folder keys.
 * Keep in sync with Unity export: folder `custom_vessel_<authoringId>`,
 * manifest addressableKey still `custom_vessel/<authoringId>`.
 */

import {
  UnityTool,
  UnityVesselContainer,
  UnityVesselPacket,
} from './unity-asset.models';

/** Flat capture-folder key derived from a synthetic `custom_vessel/<authoringId>` asset key. */
export function customVesselOrbitCaptureKey(authoringId: string): string {
  const id = authoringId.trim();
  return id ? `custom_vessel_${id}` : '';
}

/**
 * Resolve the orbit-capture lookup key for a tool row or adapted DBO data bag.
 * Custom vessels prefer the flat OrbitCaptureKey; others use AssetKey / AssetAddress.
 */
export function resolveOrbitCaptureKey(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  const orbitKey = data['OrbitCaptureKey'];
  if (typeof orbitKey === 'string' && orbitKey.trim()) return orbitKey.trim();
  const addr = data['AssetAddress'] ?? data['AssetKey'];
  return typeof addr === 'string' && addr.trim() ? addr.trim() : null;
}

export function toAssetRefs(ids: string[] | undefined | null): { AssetId: string }[] {
  return (ids ?? [])
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ AssetId: id }));
}

export function adaptVesselContainers(
  containers: UnityVesselContainer[] | undefined | null,
): { State: string; Tools: { AssetId: string }[] }[] {
  return (containers ?? []).map((c) => ({
    State: c.state,
    Tools: toAssetRefs(c.toolIds),
  }));
}

export function adaptVesselPackets(
  packets: UnityVesselPacket[] | undefined | null,
): { Key: string; Type: string; Value: string }[] {
  return (packets ?? []).map((p) => ({
    Key: p.key,
    Type: p.type,
    Value: p.value,
  }));
}

/**
 * DBO Data fields unique to custom / empty vessels.
 * ContainedTools here are authored vessel contents — not kit/group membership kids.
 */
export function adaptVesselToolFields(t: UnityTool): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (t.vesselType !== 'custom' && t.vesselType !== 'empty') return data;

  if (t.vesselType === 'custom') {
    if (t.authoringId) {
      data['AuthoringId'] = t.authoringId;
      const orbitKey = customVesselOrbitCaptureKey(t.authoringId);
      if (orbitKey) data['OrbitCaptureKey'] = orbitKey;
    }
    if (t.sourceFile) data['SourceFile'] = t.sourceFile;
    if (t.lastSaved) data['LastSaved'] = t.lastSaved;
    if (t.emptyVesselId) data['BaseEmptyVessel'] = { AssetId: t.emptyVesselId };
    if (t.emptyVesselAssetKey) data['EmptyVesselAssetKey'] = t.emptyVesselAssetKey;
    if (t.containedToolIds?.length) {
      data['ContainedTools'] = toAssetRefs(t.containedToolIds);
    }
    if (t.containedToolAssetKeys?.length) {
      data['ContainedToolAssetKeys'] = t.containedToolAssetKeys;
    }
    const byContainer = adaptVesselContainers(t.containers);
    if (byContainer.length) data['Containers'] = byContainer;
    const customization = adaptVesselPackets(t.packets);
    if (customization.length) data['Customization'] = customization;
    if (t.usedInAuthoredEnvironmentIds?.length) {
      data['UsedInAuthoredEnvironments'] = toAssetRefs(t.usedInAuthoredEnvironmentIds);
    }
    if (t.usedInAuthoredEnvironmentKeys?.length) {
      data['UsedInAuthoredEnvironmentKeys'] = t.usedInAuthoredEnvironmentKeys;
    }
  }

  if (t.vesselType === 'empty' && t.customVesselIds?.length) {
    data['CustomVessels'] = toAssetRefs(t.customVesselIds);
  }

  return data;
}
