import assert from 'node:assert/strict';
import { mapUnityEquipmentToLibraryAsset } from './unity-mapper.mjs';

const ivElbowpit = {
  id: 'bd245ef8-7140-5aee-af5e-248a53d6d55b',
  type: 'equipment',
  name: 'Iv Elbowpit Left',
  assetKey: 'equipment_iv_elbowpit_left',
  prefabPath:
    'Assets/SimX/AssetBundles/Equipment/IV Equipment/equipment_iv_elbowpit_left.prefab',
  primaryMetadata: {
    id: '5ef7455b-5799-5196-86e2-4cbbccb5ec25',
    key: 'IVElbowPitLeft',
    valueType: 'enum',
    valueShape: 'enum',
    possibleValues: [
      'none',
      'cannula',
      'salineLock',
      'iv',
      'buretteConnected',
    ],
    defaultValue: 'none',
    examples: ['none, cannula, salineLock, iv, buretteConnected'],
    description:
      'Primary control (matches documentation hint): ProcedureController step strings `IVElbowPitLeft`.',
    sourceScripts: 'IVEquipmentController',
    complexSchema: null,
    controllerType: 'ProcedureController',
  },
  metadata: [
    {
      id: '5cd2ca47-785d-527a-809d-3ddebcdfce36',
      key: 'bloodDraw-Disabled',
      valueType: 'bool',
      valueShape: 'primitive',
      possibleValues: null,
      defaultValue: null,
      examples: ['true / false'],
      description: 'Boolean; equipment or step disabled',
      sourceScripts: null,
      complexSchema: null,
      controllerType: null,
    },
  ],
  interactionLocations: [
    {
      interactionId: 'd4c3740b-f832-5551-ba30-b9031b6b579f',
      assetIds: [],
      availableIn: null,
    },
    {
      interactionId: '340de169-1fd1-5f63-965d-3a3e7bff7081',
      assetIds: [],
      availableIn: ['Filled'],
    },
  ],
  characterIds: [],
  tags: ['Vascular Access'],
};

const interactionById = new Map([
  [
    'd4c3740b-f832-5551-ba30-b9031b6b579f',
    { id: 'd4c3740b-f832-5551-ba30-b9031b6b579f', name: 'IVSite', location: 'IVSite' },
  ],
  [
    '340de169-1fd1-5f63-965d-3a3e7bff7081',
    {
      id: '340de169-1fd1-5f63-965d-3a3e7bff7081',
      name: 'NebuCap',
      location: 'NebuCap',
    },
  ],
]);

const mapped = mapUnityEquipmentToLibraryAsset(ivElbowpit, { interactionById });

assert.equal(mapped.assetType, 'equipment');
assert.equal(mapped.assetId, 'equipment_iv_elbowpit_left');

assert.deepEqual(mapped.data.primaryMetadata, {
  key: 'IVElbowPitLeft',
  label: 'IVElbowPitLeft',
  valueType: 'enum',
  exposed: true,
  defaultValue: 'none',
  possibleValues: ['none', 'cannula', 'salineLock', 'iv', 'buretteConnected'],
  controllerType: 'ProcedureController',
  description:
    'Primary control (matches documentation hint): ProcedureController step strings `IVElbowPitLeft`.',
  valueShape: 'enum',
});

assert.equal(mapped.data.metadata[0].key, 'IVElbowPitLeft');
assert.deepEqual(mapped.data.metadata[0].possibleValues, [
  'none',
  'cannula',
  'salineLock',
  'iv',
  'buretteConnected',
]);
assert.equal(mapped.data.metadata[0].controllerType, 'ProcedureController');
assert.equal(mapped.data.metadata[0].valueShape, 'enum');
assert.equal(mapped.data.metadata[1].key, 'bloodDraw-Disabled');
assert.equal(mapped.data.metadata[1].possibleValues, null);
assert.equal(mapped.data.metadata[1].controllerType, null);

assert.equal(mapped.data.interactionLocations.length, 2);
assert.equal(mapped.data.interactionLocations[0].availableIn, null);
assert.equal(mapped.data.interactionLocations[0].name, 'IVSite');
assert.deepEqual(mapped.data.interactionLocations[1].availableIn, ['Filled']);
assert.equal(mapped.data.interactionLocations[1].name, 'NebuCap');

console.log('unity-mapper equipment possibleValues / availableIn checks passed');
