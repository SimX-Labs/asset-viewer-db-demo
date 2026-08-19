import { OrbitToolStateController } from './orbit-manifest';
import { resolveDefaultStateName, visibleNodeIdsForState } from './tool-state';

function controller(): OrbitToolStateController {
  return {
    key: 'state',
    defaultState: 'closed',
    // "shared" appears in two states (overlap); "empty" shows nothing.
    managedNodeIds: ['ToolStateNode_0', 'ToolStateNode_1', 'ToolStateNode_2'],
    states: [
      { name: 'closed', visibleNodeIds: ['ToolStateNode_0', 'ToolStateNode_2'] },
      { name: 'open', visibleNodeIds: ['ToolStateNode_1', 'ToolStateNode_2'] },
      { name: 'empty', visibleNodeIds: [] },
    ],
  };
}

describe('resolveDefaultStateName', () => {
  it('uses the declared default when it names a real state', () => {
    expect(resolveDefaultStateName(controller())).toBe('closed');
  });

  it('falls back to the first state when the default is unknown', () => {
    const c = controller();
    c.defaultState = 'does-not-exist';
    expect(resolveDefaultStateName(c)).toBe('closed');
  });

  it('falls back to the first state when the default is empty', () => {
    const c = controller();
    c.defaultState = '';
    expect(resolveDefaultStateName(c)).toBe('closed');
  });

  it('returns empty string when there are no states', () => {
    expect(resolveDefaultStateName(null)).toBe('');
    expect(resolveDefaultStateName({ ...controller(), states: [] })).toBe('');
  });
});

describe('visibleNodeIdsForState', () => {
  it('returns exactly the nodes listed for the state', () => {
    const set = visibleNodeIdsForState(controller(), 'closed');
    expect([...set].sort()).toEqual(['ToolStateNode_0', 'ToolStateNode_2']);
  });

  it('keeps overlapping nodes visible in every state that lists them', () => {
    expect(visibleNodeIdsForState(controller(), 'closed').has('ToolStateNode_2')).toBeTrue();
    expect(visibleNodeIdsForState(controller(), 'open').has('ToolStateNode_2')).toBeTrue();
  });

  it('hides managed nodes not listed in the selected state', () => {
    const set = visibleNodeIdsForState(controller(), 'open');
    expect(set.has('ToolStateNode_0')).toBeFalse();
  });

  it('shows nothing for an empty state', () => {
    expect(visibleNodeIdsForState(controller(), 'empty').size).toBe(0);
  });

  it('shows nothing for an unknown state name (no-op sweep)', () => {
    expect(visibleNodeIdsForState(controller(), 'nope').size).toBe(0);
    expect(visibleNodeIdsForState(null, 'closed').size).toBe(0);
  });
});
