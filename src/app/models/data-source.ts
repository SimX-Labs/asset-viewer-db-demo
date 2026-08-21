/**
 * Where a Unity Asset DB row was scraped from. Derived from category / vessel
 * type at load time — it is a property of the pipeline, not stored in each JSON file.
 *
 *   Client scrape        — Unity client addressables, prefabs, and master assets
 *   Shared library git   — env-authoring-library (CustomVessels + Authored Environments)
 *   API/DB               — Asset Database Postgres (MedicationDatabase export)
 *   Scenario Creator     — scenario-creator-cases JSON
 *   Unknown              — type has no mapped scrape path
 */
export type DataSource =
  | 'client-scrape'
  | 'shared-library-git'
  | 'api-db'
  | 'scenario-creator'
  | 'unknown';

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  'client-scrape': 'Client scrape',
  'shared-library-git': 'Shared library git',
  'api-db': 'API/DB',
  'scenario-creator': 'Scenario Creator',
  unknown: 'Unknown',
};

export const DATA_SOURCE_HINTS: Record<DataSource, string> = {
  'client-scrape': 'Scraped from the Unity client (addressables, prefabs, master assets)',
  'shared-library-git': 'Scraped from the shared env-authoring-library git repo',
  'api-db': 'Imported from the Asset Database API / Postgres',
  'scenario-creator': 'Scraped from scenario-creator case files',
  unknown: 'Source is not mapped for this type',
};

/** Flat categories whose scrape origin does not depend on a subcategory. */
const CATEGORY_SOURCE: Record<string, DataSource> = {
  Tooling: 'client-scrape',
  Audio: 'client-scrape',
  Videos: 'client-scrape',
  Characters: 'client-scrape',
  Equipment: 'client-scrape',
  Clothing: 'client-scrape',
  Environments: 'client-scrape',
  Interactions: 'client-scrape',
  'Character Metadata': 'client-scrape',
  'Tool Metadata': 'client-scrape',
  Scenes: 'client-scrape',
  Medications: 'api-db',
  Waveforms: 'scenario-creator',
  Scenarios: 'scenario-creator',
  'Authored Environments': 'shared-library-git',
};

/**
 * Subcategory overrides. Vessels split: empty vessels are the client Addressables
 * `vessel` label; custom vessels are env-authoring-library `.vessel` files.
 */
const SUBCATEGORY_SOURCE: Record<string, Record<string, DataSource>> = {
  Vessels: {
    empty: 'client-scrape',
    custom: 'shared-library-git',
  },
};

export function dataSourceLabel(source: DataSource): string {
  return DATA_SOURCE_LABELS[source];
}

export function dataSourceHint(source: DataSource): string {
  return DATA_SOURCE_HINTS[source];
}

export function sourceForCategory(
  category: string,
  subKey?: string | null,
): DataSource {
  if (subKey) {
    const override = SUBCATEGORY_SOURCE[category]?.[subKey];
    if (override) return override;
  }
  return CATEGORY_SOURCE[category] ?? 'unknown';
}

export function sourceForUnityAsset(asset: {
  _Category?: string;
  Data?: Record<string, unknown>;
}): DataSource {
  const category = asset._Category ?? '';
  if (category === 'Vessels') {
    const vesselType = (asset.Data?.['VesselType'] as string | undefined) || 'empty';
    return sourceForCategory(category, vesselType);
  }
  return sourceForCategory(category);
}
