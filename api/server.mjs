/**
 * Asset Database PoC API — Library-compatible HTTP surface over public/db/.
 *
 * Endpoints (mirrors Asset Library contract used by scenario-creator):
 *   POST /assets
 *   GET  /tags                  → []
 *   GET  /tag-categories        → []
 *   GET  /asset-image/:id       → 501
 *   GET  /system/health
 *
 * Supported assetType values: "tool" (Unity kind===tool), "equipment".
 */

import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUnityDbFromDir } from './load-unity-db.mjs';
import {
  SUPPORTED_LIBRARY_TYPES,
  listUnityEquipment,
  listUnityTools,
  mapUnityEquipmentToLibraryAsset,
  mapUnityToolToLibraryAsset,
  unsupportedTypeMessage,
} from './unity-mapper.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4301);
const DB_DIR =
  process.env.UNITY_ASSET_DB_DIR ||
  path.resolve(__dirname, '../public/db');

console.log(`Loading Unity asset DB from ${DB_DIR}…`);
const bundle = loadUnityDbFromDir(DB_DIR);
const tools = listUnityTools(bundle);
const equipment = listUnityEquipment(bundle);
console.log(
  `Loaded ${tools.length} tools (kind=tool), ${equipment.length} equipment.`,
);
console.table(bundle.meta?.counts ?? {});

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/system/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tags', (_req, res) => {
  res.json([]);
});

app.get('/tag-categories', (_req, res) => {
  res.json([]);
});

app.get('/asset-image/:id', (_req, res) => {
  res.status(501).json({
    message:
      'Asset Database does not yet serve asset images (no image store on the Unity export).',
  });
});

/**
 * Library-compatible asset query.
 * Body fields used by scenario-creator today: assetType, dataId, returnType, images,
 * searchColumn, searchValue, assetId.
 */
app.post('/assets', (req, res) => {
  const body = req.body ?? {};
  const assetTypes = Array.isArray(body.assetType)
    ? body.assetType
    : body.assetType
      ? [body.assetType]
      : [];

  if (!body.dataId && !body.assetId && assetTypes.length === 0) {
    return res.status(400).json({
      message: 'POST /assets requires assetType, dataId, or assetId.',
    });
  }

  if (assetTypes.length > 0) {
    const unsupported = assetTypes.filter(
      (t) => !SUPPORTED_LIBRARY_TYPES.includes(t),
    );
    if (unsupported.length > 0) {
      return res.status(501).json({
        message: unsupportedTypeMessage(unsupported[0]),
      });
    }
  }

  const includeData = body.returnType !== 'basic';
  const includeImages = !!body.images;
  const mapOpts = { includeData, includeImages };

  /** @type {object[]} */
  let results = [];

  // Id-only lookup searches both catalogs; typed queries stay scoped.
  if (body.dataId || body.assetId) {
    results = [
      ...tools.map((t) => mapUnityToolToLibraryAsset(t, mapOpts)),
      ...equipment.map((e) => mapUnityEquipmentToLibraryAsset(e, mapOpts)),
    ];
  } else {
    if (assetTypes.includes('tool')) {
      results.push(...tools.map((t) => mapUnityToolToLibraryAsset(t, mapOpts)));
    }
    if (assetTypes.includes('equipment')) {
      results.push(
        ...equipment.map((e) => mapUnityEquipmentToLibraryAsset(e, mapOpts)),
      );
    }
  }

  if (body.dataId) {
    results = results.filter((a) => a.dataId === body.dataId);
  } else if (body.assetId) {
    results = results.filter((a) => a.assetId === body.assetId);
  }

  if (body.searchColumn && body.searchValue != null && body.searchValue !== '') {
    const col = body.searchColumn;
    const needle = String(body.searchValue).toLowerCase();
    const allowed = new Set([
      'assetId',
      'assetName',
      'dataId',
      'description',
      'prefabName',
    ]);
    if (allowed.has(col)) {
      results = results.filter((a) =>
        String(a[col] ?? '')
          .toLowerCase()
          .includes(needle),
      );
    }
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Asset Database API listening on http://localhost:${PORT}`);
});
