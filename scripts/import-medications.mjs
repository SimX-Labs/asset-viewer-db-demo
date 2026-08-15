/**
 * Convert a Unity MedicationDatabase export into medications.json
 * (camelCase row array matching other Unity Asset DB catalog files).
 *
 * Usage:
 *   node scripts/import-medications.mjs <path-to-medicationDatabase.json> [out-path]
 *
 * Defaults:
 *   out-path = <UNITY_ASSET_DB_DIR>/medications.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveDbRoot } from './resolve-db-root.mjs';

const srcPath = resolve(
  process.argv[2] ??
    'medicationDatabase.json',
);
const outPath = resolve(
  process.argv[3] ?? join(resolveDbRoot(), 'medications.json'),
);

if (!existsSync(srcPath)) {
  console.error(`Source file not found: ${srcPath}`);
  console.error(
    'Usage: node scripts/import-medications.mjs <medicationDatabase.json> [out]',
  );
  process.exit(1);
}

/**
 * @param {unknown} value
 * @returns {string[] | null}
 */
function normalizeLegacyIds(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const ids = value.filter((v) => typeof v === 'string' && v.length > 0);
    return ids.length ? ids : null;
  }
  if (typeof value === 'string' && value.length > 0) return [value];
  return null;
}

/**
 * @param {{ Filepath?: string | null, IsNormalMap?: boolean } | null | undefined} tex
 */
function convertTexture(tex) {
  if (!tex || typeof tex !== 'object') return null;
  const filepath = tex.Filepath ?? '';
  if (filepath == null || filepath === '') return null;
  return {
    filepath: String(filepath),
    isNormalMap: !!tex.IsNormalMap,
  };
}

/**
 * @param {Record<string, unknown>} unity
 */
function convertMedication(unity) {
  const legacyIds = normalizeLegacyIds(unity.LegacyIDs);
  const displayStrings = unity.DisplayStrings
    ? {
        pyxisName: unity.DisplayStrings.PyxisName ?? null,
        pumpName: unity.DisplayStrings.PumpName ?? null,
        labelTitle: unity.DisplayStrings.LabelTitle ?? null,
        labelSubTitle: unity.DisplayStrings.LabelSubTitle ?? null,
        labelSubDose: unity.DisplayStrings.LabelSubDose ?? null,
      }
    : null;

  const nameFromUnity =
    (typeof unity.Name === 'string' && unity.Name.trim()) || null;
  const name =
    nameFromUnity ||
    displayStrings?.labelTitle ||
    displayStrings?.pyxisName ||
    legacyIds?.[0] ||
    (typeof unity.MedID === 'string' ? unity.MedID : null) ||
    'Unnamed medication';

  const textureInfo = unity.TextureInfo
    ? {
        labelTexture: convertTexture(unity.TextureInfo.LabelTexture) ?? {
          filepath: '',
          isNormalMap: false,
        },
        boxTexture: convertTexture(unity.TextureInfo.BoxTexture),
      }
    : null;

  return {
    id: String(unity.UUID),
    type: 'medication',
    name,
    medId: String(unity.MedID ?? ''),
    medContainer: String(unity.MedContainer ?? ''),
    legacyIds,
    displayStrings,
    textureInfo,
    liquidInfo: unity.LiquidInfo
      ? {
          liquidColorOverride: unity.LiquidInfo.LiquidColorOverride ?? null,
        }
      : null,
    pillInfo: unity.PillInfo
      ? { pillCount: Number(unity.PillInfo.PillCount ?? 0) }
      : null,
    ivBagInfo: unity.IVBagInfo
      ? { bagSize: String(unity.IVBagInfo.BagSize ?? '') }
      : null,
    syringeInfo: unity.SyringeInfo
      ? {
          syringeType: unity.SyringeInfo.SyringeType ?? null,
          syringeMethod: unity.SyringeInfo.SyringeMethod ?? null,
        }
      : null,
    vialInfo: unity.VialInfo
      ? {
          isPowder: !!unity.VialInfo.IsPowder,
          vialLiquidColorOverride:
            unity.VialInfo.VialLiquidColorOverride ?? null,
        }
      : null,
    // DB-only fields (not in Unity export); seeded empty for future edit UI.
    additional: {
      defaultIvPumpUnits: null,
      defaultIvPumpIncrements: null,
      syringeSize: null,
    },
    tags: unity.MedContainer ? [String(unity.MedContainer)] : [],
  };
}

const raw = JSON.parse(readFileSync(srcPath, 'utf8'));
const list = Array.isArray(raw?.MedicationDatabase)
  ? raw.MedicationDatabase
  : Array.isArray(raw)
    ? raw
    : null;

if (!list) {
  console.error(
    'Expected { MedicationDatabase: [...] } or a medication array.',
  );
  process.exit(1);
}

const medications = list.map(convertMedication);
writeFileSync(outPath, JSON.stringify(medications, null, 2) + '\n');
console.log(`Wrote ${medications.length} medications → ${outPath}`);
