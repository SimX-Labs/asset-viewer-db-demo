import assert from 'node:assert/strict';
import {
  customVesselOrbitCaptureKey,
  vesselFieldsForLibraryAsset,
} from './unity-mapper.mjs';

const custom = {
  id: 'bca45e84-8285-5e0e-a211-f14b627b0a06',
  kind: 'vessel',
  vesselType: 'custom',
  authoringId: 'Snack Cart-112232',
  emptyVesselId: '7ca7c8de-ff13-56cb-a061-1086a1a99bef',
  emptyVesselAssetKey: 'group_cart_customizable',
  containedToolIds: ['fa3f024b-43af-5d2a-84a3-1a41d66244a7'],
  containers: [{ state: '1', toolIds: ['fa3f024b-43af-5d2a-84a3-1a41d66244a7'], toolAssetKeys: [] }],
  packets: [{ key: 'body', type: 'Color', value: '321044' }],
};

assert.equal(
  customVesselOrbitCaptureKey('Snack Cart-112232'),
  'custom_vessel_Snack Cart-112232',
);

const fields = vesselFieldsForLibraryAsset(custom);
assert.equal(fields.orbitCaptureKey, 'custom_vessel_Snack Cart-112232');
assert.equal(fields.emptyVesselId, '7ca7c8de-ff13-56cb-a061-1086a1a99bef');
assert.deepEqual(fields.containedToolIds, ['fa3f024b-43af-5d2a-84a3-1a41d66244a7']);
assert.equal(fields.packets.length, 1);

const empty = vesselFieldsForLibraryAsset({
  kind: 'vessel',
  vesselType: 'empty',
  customVesselIds: ['bca45e84-8285-5e0e-a211-f14b627b0a06'],
});
assert.deepEqual(empty.customVesselIds, ['bca45e84-8285-5e0e-a211-f14b627b0a06']);
assert.equal(empty.orbitCaptureKey, undefined);

console.log('unity-mapper custom vessel checks passed');
