import { OrbitCaptureManifest } from '../models/orbit-manifest';
import { OrbitModelControlsService } from './orbit-model-controls.service';

function manifest(): OrbitCaptureManifest {
  return {
    images: [],
    toolStateController: {
      key: 'state',
      defaultState: 'open',
      managedNodeIds: ['Node_0', 'Node_1'],
      states: [
        { name: 'closed', visibleNodeIds: ['Node_0'] },
        { name: 'open', visibleNodeIds: ['Node_1'] },
      ],
    },
    vesselContainers: {
      managedNodeIds: ['Lid', 'Contents'],
      containers: [
        // Permanent anchor: no open/closed visual difference.
        {
          id: 'outside',
          defaultOpen: true,
          toggleable: false,
          incompatibleContainerIds: [],
          shownNodeIds: [],
          hiddenNodeIds: [],
        },
        {
          id: 'drawer',
          defaultOpen: false,
          toggleable: true,
          incompatibleContainerIds: [],
          contentsNodeId: 'Contents',
          shownNodeIds: [],
          hiddenNodeIds: ['Lid'],
        },
      ],
    },
  };
}

describe('OrbitModelControlsService', () => {
  let controls: OrbitModelControlsService;

  beforeEach(() => {
    controls = new OrbitModelControlsService();
    controls.load(manifest());
  });

  it('selects the controller default on load', () => {
    expect(controls.selectedState()).toBe('open');
    expect(controls.isDefaultState('open')).toBeTrue();
    expect(controls.isDefaultState('closed')).toBeFalse();
  });

  it('ignores a state name the controller does not declare', () => {
    controls.selectState('nope');
    expect(controls.selectedState()).toBe('open');
  });

  it('opens containers marked default-open and leaves the rest closed', () => {
    expect(controls.isContainerOpen('outside')).toBeTrue();
    expect(controls.isContainerOpen('drawer')).toBeFalse();
  });

  it('counts only toggleable containers', () => {
    expect(controls.toggleableContainerCount()).toBe(1);
    expect(controls.openContainerCount()).toBe(0);
  });

  it('toggles a toggleable container both ways', () => {
    const drawer = controls.containerOptions()[1];
    controls.toggleContainer(drawer);
    expect(controls.isContainerOpen('drawer')).toBeTrue();
    expect(controls.openContainerCount()).toBe(1);

    controls.toggleContainer(drawer);
    expect(controls.isContainerOpen('drawer')).toBeFalse();
  });

  it('cannot close a container with no open/closed difference', () => {
    const outside = controls.containerOptions()[0];
    controls.toggleContainer(outside);
    expect(controls.isContainerOpen('outside')).toBeTrue();
  });

  it('clears the previous capture when loading one with no controls', () => {
    controls.load({ images: [] });
    expect(controls.hasControls()).toBeFalse();
    expect(controls.selectedState()).toBe('');
    expect(controls.containerOptions()).toEqual([]);
  });
});
