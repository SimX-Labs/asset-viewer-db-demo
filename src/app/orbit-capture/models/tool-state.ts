// models/tool-state.ts
// Pure helpers that reproduce a Unity ToolStateController's show/hide logic against the
// exported multi-state GLB. Kept free of Three.js so they can be unit-tested directly.
import { OrbitToolStateController } from './orbit-manifest';

/**
 * Picks the state to select on load: the controller's declared default when it names a real
 * state, otherwise the first state. Returns '' when there are no states.
 */
export function resolveDefaultStateName(controller: OrbitToolStateController | null | undefined): string {
  const states = controller?.states ?? [];
  if (!states.length) return '';
  const declared = controller?.defaultState;
  if (declared && states.some((s) => s.name === declared)) {
    return declared;
  }
  return states[0].name;
}

/**
 * The set of managed node ids that should be VISIBLE for the given state. Mirrors
 * ToolStateController.SetNewState: a managed node is shown iff it is listed in the selected
 * state's show objects; every other managed node is hidden. An unknown state name yields an
 * empty set (nothing shown), matching the controller's silent no-op / all-off sweep.
 */
export function visibleNodeIdsForState(
  controller: OrbitToolStateController | null | undefined,
  stateName: string,
): Set<string> {
  const state = (controller?.states ?? []).find((s) => s.name === stateName);
  return new Set(state?.visibleNodeIds ?? []);
}
