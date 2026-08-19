/** Tag taxonomy models — mirrors legacy asset-database Tag / TagCategory. */

import { UNITY_CATEGORY_ORDER } from './unity-asset.models';

export type TagCategoryScope = 'global' | 'type';
export type TagSource = 'authored' | 'scraped';

export interface TagRecord {
  dataId: string;
  label: string;
  /** Category dataIds this tag belongs to. */
  categories: string[];
  /** Scraped tags come from the Unity db pipeline and cannot be renamed or deleted. */
  source?: TagSource;
}

export interface TagCategoryRecord {
  dataId: string;
  label: string;
  /** Tag dataIds in this category. */
  tags: string[];
  /** Global tags apply to every asset type; type tags apply to one type. */
  scope: TagCategoryScope;
  /** Unity sidebar category this type-scoped group applies to. Absent for global. */
  assetType?: string;
}

export interface TagTaxonomy {
  categories: TagCategoryRecord[];
  tags: TagRecord[];
}

export const TAG_TAXONOMY_FILE = 'tag-taxonomy.json';
export const TAG_TAXONOMY_STORAGE_KEY = 'simx-asset-viewer-tag-taxonomy';
/** Set while the tag page has unflushed edits so a refresh keeps the draft. */
export const TAG_TAXONOMY_DRAFT_KEY = 'simx-asset-viewer-tag-taxonomy-draft';
export const EMPTY_TAG_TAXONOMY: TagTaxonomy = { categories: [], tags: [] };

export const GLOBAL_TAG_CATEGORY_ID = 'global';
export const TYPE_TAG_CATEGORY_PREFIX = 'type:';
export const SCRAPED_TAG_ID_PREFIX = 'scraped:';

export function typeTagCategoryId(assetType: string): string {
  return `${TYPE_TAG_CATEGORY_PREFIX}${assetType}`;
}

export function scrapedTagId(slug: string): string {
  return `${SCRAPED_TAG_ID_PREFIX}${slug}`;
}

export function isBuiltInTagCategoryId(dataId: string): boolean {
  return (
    dataId === GLOBAL_TAG_CATEGORY_ID ||
    dataId.startsWith(TYPE_TAG_CATEGORY_PREFIX)
  );
}

export function isScrapedTag(
  tag: Pick<TagRecord, 'dataId' | 'source'>,
): boolean {
  return (
    tag.source === 'scraped' || tag.dataId.startsWith(SCRAPED_TAG_ID_PREFIX)
  );
}

function scraped(
  slug: string,
  label: string,
  categories: string[],
): TagRecord {
  return { dataId: scrapedTagId(slug), label, categories, source: 'scraped' };
}

/** Data-based tags written by the documentation scrape. Locked in the Tags UI. */
export const SCRAPED_TAGS: TagRecord[] = [
  scraped('grabbable', 'Grabbable', [typeTagCategoryId('Tooling')]),
  scraped('prop', 'Prop', [typeTagCategoryId('Tooling')]),
  scraped('generator', 'Generator', [typeTagCategoryId('Tooling')]),
  scraped('core', 'Core', [
    typeTagCategoryId('Characters'),
    typeTagCategoryId('Environments'),
  ]),
  scraped('military', 'Military', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('pediatric', 'Pediatric', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('neonatal', 'Neonatal', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('obstetric', 'Obstetric', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('prehospital', 'Prehospital', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('trauma', 'Trauma', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('surgical', 'Surgical', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('critical-care', 'Critical Care', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('home-care', 'Home Care', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('canine', 'Canine', [GLOBAL_TAG_CATEGORY_ID]),
  scraped('airway', 'Airway', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Interactions'),
    typeTagCategoryId('Character Metadata'),
  ]),
  scraped('oxygen', 'Oxygen', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Equipment'),
  ]),
  scraped('ventilator', 'Ventilator', [typeTagCategoryId('Tooling')]),
  scraped('vascular-access', 'Vascular Access', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Equipment'),
    typeTagCategoryId('Videos'),
  ]),
  scraped('infusion', 'Infusion', [typeTagCategoryId('Tooling')]),
  scraped('hemorrhage-control', 'Hemorrhage Control', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Equipment'),
  ]),
  scraped('wound-care', 'Wound Care', [typeTagCategoryId('Tooling')]),
  scraped('cardiac', 'Cardiac', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Videos'),
  ]),
  scraped('monitoring', 'Monitoring', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Equipment'),
  ]),
  scraped('respiratory', 'Respiratory', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Medications'),
  ]),
  scraped('imaging', 'Imaging', [typeTagCategoryId('Tooling')]),
  scraped('labs', 'Labs', [typeTagCategoryId('Tooling')]),
  scraped('gi-gu', 'GI / GU', [typeTagCategoryId('Tooling')]),
  scraped('neuro', 'Neuro', [typeTagCategoryId('Tooling')]),
  scraped('ppe', 'PPE', [
    typeTagCategoryId('Tooling'),
    typeTagCategoryId('Clothing'),
  ]),
  scraped('med-admin', 'Med Admin', [typeTagCategoryId('Tooling')]),
  scraped('cart', 'Cart', [typeTagCategoryId('Vessels')]),
  scraped('bag', 'Bag', [typeTagCategoryId('Vessels')]),
  scraped('kit', 'Kit', [typeTagCategoryId('Vessels')]),
  scraped('room-item', 'Room Item', [typeTagCategoryId('Vessels')]),
  scraped('combat', 'Combat', [typeTagCategoryId('Audio')]),
  scraped('ambient', 'Ambient', [typeTagCategoryId('Audio')]),
  scraped('radio', 'Radio', [typeTagCategoryId('Audio')]),
  scraped('equipment-loop', 'Equipment Loop', [typeTagCategoryId('Audio')]),
  scraped('fast', 'FAST', [typeTagCategoryId('Videos')]),
  scraped('lung', 'Lung', [typeTagCategoryId('Videos')]),
  scraped('ocular', 'Ocular', [typeTagCategoryId('Videos')]),
  scraped('renal', 'Renal', [typeTagCategoryId('Videos')]),
  scraped('newborn', 'Newborn', [typeTagCategoryId('Characters')]),
  scraped('toddler', 'Toddler', [typeTagCategoryId('Characters')]),
  scraped('child', 'Child', [typeTagCategoryId('Characters')]),
  scraped('adolescent', 'Adolescent', [typeTagCategoryId('Characters')]),
  scraped('adult', 'Adult', [typeTagCategoryId('Characters')]),
  scraped('elder', 'Elder', [typeTagCategoryId('Characters')]),
  scraped('pregnant', 'Pregnant', [typeTagCategoryId('Characters')]),
  scraped('injury-presentation', 'Injury Presentation', [
    typeTagCategoryId('Characters'),
  ]),
  scraped('io', 'IO', [typeTagCategoryId('Equipment')]),
  scraped('defibrillation', 'Defibrillation', [typeTagCategoryId('Equipment')]),
  scraped('wound', 'Wound', [
    typeTagCategoryId('Equipment'),
    typeTagCategoryId('Interactions'),
  ]),
  scraped('immobilization', 'Immobilization', [typeTagCategoryId('Equipment')]),
  scraped('chest-procedure', 'Chest Procedure', [typeTagCategoryId('Equipment')]),
  scraped('hair', 'Hair', [typeTagCategoryId('Equipment')]),
  scraped('identification', 'Identification', [typeTagCategoryId('Equipment')]),
  scraped('comfort', 'Comfort', [typeTagCategoryId('Equipment')]),
  scraped('assessment', 'Assessment', [typeTagCategoryId('Equipment')]),
  scraped('insulin-pump', 'Insulin Pump', [typeTagCategoryId('Equipment')]),
  scraped('restraints', 'Restraints', [typeTagCategoryId('Equipment')]),
  scraped('civilian', 'Civilian', [typeTagCategoryId('Clothing')]),
  scraped('patient', 'Patient', [typeTagCategoryId('Clothing')]),
  scraped('scrubs', 'Scrubs', [typeTagCategoryId('Clothing')]),
  scraped('uniform', 'Uniform', [typeTagCategoryId('Clothing')]),
  scraped('footwear', 'Footwear', [typeTagCategoryId('Clothing')]),
  scraped('undergarment', 'Undergarment', [typeTagCategoryId('Clothing')]),
  scraped('soiled', 'Soiled', [typeTagCategoryId('Clothing')]),
  scraped('acls', 'ACLS', [typeTagCategoryId('Medications')]),
  scraped('analgesic', 'Analgesic', [typeTagCategoryId('Medications')]),
  scraped('sedation', 'Sedation', [typeTagCategoryId('Medications')]),
  scraped('vasopressor', 'Vasopressor', [typeTagCategoryId('Medications')]),
  scraped('antibiotic', 'Antibiotic', [typeTagCategoryId('Medications')]),
  scraped('iv-fluid', 'IV Fluid', [typeTagCategoryId('Medications')]),
  scraped('electrolyte', 'Electrolyte', [typeTagCategoryId('Medications')]),
  scraped('insulin', 'Insulin', [typeTagCategoryId('Medications')]),
  scraped('antidote', 'Antidote', [typeTagCategoryId('Medications')]),
  scraped('anticoagulant', 'Anticoagulant', [typeTagCategoryId('Medications')]),
  scraped('antiemetic', 'Antiemetic', [typeTagCategoryId('Medications')]),
  scraped('psychiatric', 'Psychiatric', [
    typeTagCategoryId('Medications'),
    typeTagCategoryId('Environments'),
  ]),
  scraped('arrhythmia', 'Arrhythmia', [typeTagCategoryId('Waveforms')]),
  scraped('default-trace', 'Default Trace', [typeTagCategoryId('Waveforms')]),
  scraped('artifact', 'Artifact', [typeTagCategoryId('Waveforms')]),
  scraped('capnography', 'Capnography', [typeTagCategoryId('Waveforms')]),
  scraped('anesthesia', 'Anesthesia', [typeTagCategoryId('Waveforms')]),
  scraped('demo', 'Demo', [typeTagCategoryId('Scenarios')]),
  scraped('wip', 'WIP', [typeTagCategoryId('Scenarios')]),
  scraped('nursing', 'Nursing', [
    typeTagCategoryId('Scenarios'),
    typeTagCategoryId('Authored Environments'),
  ]),
  scraped('osce', 'OSCE', [typeTagCategoryId('Scenarios')]),
  scraped('skills', 'Skills', [typeTagCategoryId('Scenarios')]),
  scraped('skills-trainer', 'Skills Trainer', [
    typeTagCategoryId('Authored Environments'),
  ]),
  scraped('test', 'Test', [typeTagCategoryId('Authored Environments')]),
  scraped('ed', 'ED', [typeTagCategoryId('Environments')]),
  scraped('inpatient', 'Inpatient', [typeTagCategoryId('Environments')]),
  scraped('icu', 'ICU', [typeTagCategoryId('Environments')]),
  scraped('exam-room', 'Exam Room', [typeTagCategoryId('Environments')]),
  scraped('field', 'Field', [typeTagCategoryId('Environments')]),
  scraped('aviation', 'Aviation', [typeTagCategoryId('Environments')]),
  scraped('night', 'Night', [typeTagCategoryId('Environments')]),
  scraped('outdoor', 'Outdoor', [typeTagCategoryId('Environments')]),
  scraped('ambulance', 'Ambulance', [typeTagCategoryId('Environments')]),
  scraped('head-face', 'Head / Face', [typeTagCategoryId('Interactions')]),
  scraped('chest', 'Chest', [typeTagCategoryId('Interactions')]),
  scraped('abdomen-pelvis', 'Abdomen / Pelvis', [typeTagCategoryId('Interactions')]),
  scraped('upper-extremity', 'Upper Extremity', [typeTagCategoryId('Interactions')]),
  scraped('lower-extremity', 'Lower Extremity', [typeTagCategoryId('Interactions')]),
  scraped('line-device', 'Line / Device', [typeTagCategoryId('Interactions')]),
  scraped('eyes', 'Eyes', [typeTagCategoryId('Character Metadata')]),
  scraped('clothing-meta', 'Clothing', [typeTagCategoryId('Character Metadata')]),
  scraped('equipment-meta', 'Equipment', [typeTagCategoryId('Character Metadata')]),
  scraped('cpr', 'CPR', [typeTagCategoryId('Character Metadata')]),
  scraped('animation', 'Animation', [typeTagCategoryId('Character Metadata')]),
  scraped('injury', 'Injury', [typeTagCategoryId('Character Metadata')]),
];

export function builtInTagCategories(): TagCategoryRecord[] {
  return [
    {
      dataId: GLOBAL_TAG_CATEGORY_ID,
      label: 'Global',
      tags: [],
      scope: 'global',
    },
    ...UNITY_CATEGORY_ORDER.map((assetType) => ({
      dataId: typeTagCategoryId(assetType),
      label: assetType,
      tags: [] as string[],
      scope: 'type' as const,
      assetType,
    })),
  ];
}

function takeMatch(
  remaining: TagCategoryRecord[],
  builtin: TagCategoryRecord,
): TagCategoryRecord | undefined {
  const byId = remaining.findIndex((c) => c.dataId === builtin.dataId);
  if (byId >= 0) return remaining.splice(byId, 1)[0];
  const expected = builtin.label.trim().toLowerCase();
  const byLabel = remaining.findIndex(
    (c) => c.label.trim().toLowerCase() === expected,
  );
  if (byLabel >= 0) return remaining.splice(byLabel, 1)[0];
  return undefined;
}

/**
 * Guarantee a Global group plus one group per Unity asset type.
 * Legacy user-created categories matching a built-in label are remapped onto
 * the stable id; unmatched leftover groups are kept after the built-ins.
 */
export function ensureBuiltInTagCategories(taxonomy: TagTaxonomy): TagTaxonomy {
  const remaining = [...taxonomy.categories];
  const idRemap = new Map<string, string>();
  const resolved: TagCategoryRecord[] = [];

  for (const builtin of builtInTagCategories()) {
    const existing = takeMatch(remaining, builtin);
    if (existing) {
      if (existing.dataId !== builtin.dataId) {
        idRemap.set(existing.dataId, builtin.dataId);
      }
      resolved.push({
        dataId: builtin.dataId,
        label: builtin.label,
        tags: [...existing.tags],
        scope: builtin.scope,
        assetType: builtin.assetType,
      });
    } else {
      resolved.push({ ...builtin, tags: [] });
    }
  }

  for (const extra of remaining) {
    resolved.push({
      dataId: extra.dataId,
      label: extra.label,
      tags: [...extra.tags],
      scope: extra.scope === 'global' ? 'global' : 'type',
      assetType: extra.assetType || extra.label,
    });
  }

  const tags = taxonomy.tags.map((t) => ({
    ...t,
    categories: t.categories.map((id) => idRemap.get(id) ?? id),
  }));

  return ensureScrapedTags({ categories: resolved, tags });
}

/**
 * Upsert scrape-owned tags (stable ids, locked labels) and remap any
 * authored tag that already used the same label.
 */
export function ensureScrapedTags(taxonomy: TagTaxonomy): TagTaxonomy {
  const tags = taxonomy.tags.map((t) => ({
    ...t,
    categories: [...t.categories],
  }));

  for (const scraped of SCRAPED_TAGS) {
    const byId = tags.findIndex((t) => t.dataId === scraped.dataId);
    const byLabel = tags.findIndex(
      (t) =>
        t.dataId !== scraped.dataId &&
        t.source !== 'scraped' &&
        !t.dataId.startsWith(SCRAPED_TAG_ID_PREFIX) &&
        t.label.trim().toLowerCase() === scraped.label.toLowerCase(),
    );
    const existingIdx = byId >= 0 ? byId : byLabel;
    if (existingIdx >= 0) {
      const existing = tags[existingIdx];
      const categories = [...existing.categories];
      for (const catId of scraped.categories) {
        if (!categories.includes(catId)) categories.push(catId);
      }
      tags[existingIdx] = {
        ...existing,
        dataId: scraped.dataId,
        label: scraped.label,
        categories,
        source: 'scraped',
      };
    } else {
      tags.push({
        dataId: scraped.dataId,
        label: scraped.label,
        categories: [...scraped.categories],
        source: 'scraped',
      });
    }
  }

  return { categories: taxonomy.categories, tags };
}
