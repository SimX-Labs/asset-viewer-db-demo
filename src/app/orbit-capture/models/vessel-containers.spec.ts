import { OrbitVesselContainers } from './orbit-manifest';
import {
  resolveDefaultOpenContainers,
  resolveVesselNodeVisibility,
  setVesselContainerOpen,
} from './vessel-containers';

function controls(): OrbitVesselContainers {
  return {
    managedNodeIds: [
      'main-open',
      'main-closed',
      'main-contents',
      'left-open',
      'left-closed',
      'right-open',
      'right-closed',
      'outside-contents',
    ],
    containers: [
      {
        id: 'main',
        defaultOpen: false,
        toggleable: true,
        incompatibleContainerIds: [],
        shownNodeIds: ['main-open'],
        hiddenNodeIds: ['main-closed'],
        contentsNodeId: 'main-contents',
      },
      {
        id: 'left',
        defaultOpen: false,
        toggleable: true,
        parentContainerId: 'main',
        incompatibleContainerIds: ['right'],
        shownNodeIds: ['left-open'],
        hiddenNodeIds: ['left-closed'],
      },
      {
        id: 'right',
        defaultOpen: false,
        toggleable: true,
        parentContainerId: 'main',
        incompatibleContainerIds: [],
        shownNodeIds: ['right-open'],
        hiddenNodeIds: ['right-closed'],
      },
      {
        id: 'outside',
        defaultOpen: true,
        toggleable: false,
        incompatibleContainerIds: [],
        shownNodeIds: [],
        hiddenNodeIds: [],
        contentsNodeId: 'outside-contents',
      },
    ],
  };
}

describe('vessel container relationships', () => {
  it('allows multiple compatible containers to remain open', () => {
    const c = controls();
    let open = setVesselContainerOpen(c, new Set(), 'main', true);
    open = setVesselContainerOpen(c, open, 'outside', true);
    expect([...open].sort()).toEqual(['main', 'outside']);
  });

  it('opening a child recursively opens its parent', () => {
    const open = setVesselContainerOpen(controls(), new Set(), 'left', true);
    expect(open.has('left')).toBeTrue();
    expect(open.has('main')).toBeTrue();
  });

  it('opening an incompatible container closes its sibling case-insensitively', () => {
    const c = controls();
    let open = setVesselContainerOpen(c, new Set(), 'LEFT', true);
    open = setVesselContainerOpen(c, open, 'right', true);
    expect([...open].some((id) => id.toLowerCase() === 'left')).toBeFalse();
    expect(open.has('right')).toBeTrue();
    expect(open.has('main')).toBeTrue();
  });

  it('closing a parent recursively closes its children', () => {
    const c = controls();
    let open = setVesselContainerOpen(c, new Set(), 'left', true);
    open = setVesselContainerOpen(c, open, 'main', false);
    expect(open.size).toBe(0);
  });

  it('does not close permanent anchors', () => {
    const c = controls();
    const defaults = resolveDefaultOpenContainers(c);
    const afterClose = setVesselContainerOpen(c, defaults, 'outside', false);
    expect(afterClose.has('outside')).toBeTrue();
  });
});

describe('vessel container visibility', () => {
  it('shows closed visuals and hides open visuals while closed', () => {
    const visibility = resolveVesselNodeVisibility(controls(), new Set());
    expect(visibility.get('main-closed')).toBeTrue();
    expect(visibility.get('main-open')).toBeFalse();
    expect(visibility.get('main-contents')).toBeFalse();
  });

  it('swaps shown/hidden nodes and exposes contents while open', () => {
    const visibility = resolveVesselNodeVisibility(controls(), new Set(['main']));
    expect(visibility.get('main-closed')).toBeFalse();
    expect(visibility.get('main-open')).toBeTrue();
    expect(visibility.get('main-contents')).toBeTrue();
  });

  it('keeps default-open permanent contents visible', () => {
    const c = controls();
    const visibility = resolveVesselNodeVisibility(c, resolveDefaultOpenContainers(c));
    expect(visibility.get('outside-contents')).toBeTrue();
  });
});
