import assert from 'node:assert/strict';
import {
  mapUnityCharacterToLibraryAsset,
  mapUnityEquipmentToLibraryAsset,
} from './unity-mapper.mjs';

const character = {
  id: 'char-1',
  type: 'character',
  name: 'Adult 01',
  assetKey: 'character_core_adult01',
  prefabPath: 'Assets/SimX/Characters/Adult01.prefab',
  availableEquipment: ['eq-1'],
  interactionLocations: [{ interactionId: 'int-1', assetIds: [] }],
};

const equipment = {
  id: 'eq-1',
  type: 'equipment',
  name: 'Foley Site',
  assetKey: 'equipment_foley',
  prefabPath: 'Assets/SimX/Equipment/Foley.prefab',
  characterIds: ['char-1', 'missing-char'],
  interactionLocations: [{ interactionId: 'int-1', assetIds: [] }],
};

const characterById = new Map([[character.id, character]]);
const mappedEquipment = mapUnityEquipmentToLibraryAsset(equipment, {
  characterById,
});
assert.equal(mappedEquipment.assetType, 'equipment');
assert.deepEqual(mappedEquipment.data.compatibleCharacters, [
  { id: 'char-1', name: 'Adult 01', assetKey: 'character_core_adult01' },
  { id: 'missing-char', name: 'missing-char', assetKey: null },
]);

const mappedCharacter = mapUnityCharacterToLibraryAsset(character, {
  equipmentById: new Map([[equipment.id, equipment]]),
});
assert.equal(mappedCharacter.assetType, 'character');
assert.equal(mappedCharacter.assetId, 'character_core_adult01');
assert.equal(mappedCharacter.dataId, 'char-1');
assert.deepEqual(mappedCharacter.data.availableEquipment, [
  { id: 'eq-1', name: 'Foley Site', assetKey: 'equipment_foley' },
]);

console.log('unity-mapper character/equipment compatibility checks passed');
