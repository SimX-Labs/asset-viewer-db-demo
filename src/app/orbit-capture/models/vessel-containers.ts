import { OrbitVesselContainer, OrbitVesselContainers } from './orbit-manifest';

function sameId(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

function findContainer(
  controls: OrbitVesselContainers | null | undefined,
  id: string,
): OrbitVesselContainer | undefined {
  return (controls?.containers ?? []).find((container) => sameId(container.id, id));
}

function incompatible(a: OrbitVesselContainer, b: OrbitVesselContainer): boolean {
  return (
    a.incompatibleContainerIds.some((id) => sameId(id, b.id)) ||
    b.incompatibleContainerIds.some((id) => sameId(id, a.id))
  );
}

/** Build the initial open set and normalize parent/incompatibility relationships. */
export function resolveDefaultOpenContainers(
  controls: OrbitVesselContainers | null | undefined,
): Set<string> {
  let open = new Set<string>();
  for (const container of controls?.containers ?? []) {
    if (container.defaultOpen) {
      open = setVesselContainerOpen(controls, open, container.id, true);
    }
  }
  return open;
}

/**
 * Apply one Unity VesselContainer open/close operation to an immutable open-id set.
 * Opening closes incompatible containers and recursively opens parents. Closing recursively
 * closes children. Id matching is case-insensitive.
 */
export function setVesselContainerOpen(
  controls: OrbitVesselContainers | null | undefined,
  currentOpenIds: ReadonlySet<string>,
  containerId: string,
  open: boolean,
): Set<string> {
  const containers = controls?.containers ?? [];
  const target = findContainer(controls, containerId);
  const next = new Set(currentOpenIds);
  if (!target) return next;

  const canonicalOpenId = (id: string): string | undefined =>
    [...next].find((openId) => sameId(openId, id));

  const closeRecursively = (container: OrbitVesselContainer, visited: Set<string>): void => {
    const key = container.id.toLocaleLowerCase();
    if (visited.has(key)) return;
    visited.add(key);

    const existing = canonicalOpenId(container.id);
    if (existing) next.delete(existing);

    for (const child of containers) {
      if (sameId(child.parentContainerId, container.id)) {
        closeRecursively(child, visited);
      }
    }
  };

  const openRecursively = (container: OrbitVesselContainer, visited: Set<string>): void => {
    const key = container.id.toLocaleLowerCase();
    if (visited.has(key)) return;
    visited.add(key);

    if (container.parentContainerId) {
      const parent = findContainer(controls, container.parentContainerId);
      if (parent) openRecursively(parent, visited);
    }

    for (const other of containers) {
      if (sameId(other.id, container.id) || !incompatible(container, other)) continue;
      closeRecursively(other, new Set<string>());
    }

    const existing = canonicalOpenId(container.id);
    if (!existing) next.add(container.id);
  };

  if (open) {
    openRecursively(target, new Set<string>());
  } else if (target.toggleable) {
    closeRecursively(target, new Set<string>());
  }
  return next;
}

/**
 * Resolve visibility for every vessel-managed node.
 * - shown/contents nodes follow their container's open state
 * - hidden nodes are visible while their container is closed
 * - any open container hiding a node wins over another container showing it
 */
export function resolveVesselNodeVisibility(
  controls: OrbitVesselContainers | null | undefined,
  openIds: ReadonlySet<string>,
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const id of controls?.managedNodeIds ?? []) result.set(id, false);

  const isOpen = (container: OrbitVesselContainer): boolean =>
    [...openIds].some((id) => sameId(id, container.id));

  // Closed visuals and open shown/contents establish candidate visibility.
  for (const container of controls?.containers ?? []) {
    const open = isOpen(container);
    if (open) {
      if (container.contentsNodeId) result.set(container.contentsNodeId, true);
      for (const id of container.shownNodeIds) result.set(id, true);
    } else {
      for (const id of container.hiddenNodeIds) result.set(id, true);
    }
  }

  // Mirrors IsObjectHidden: any open container's ObjectsHidden entry wins.
  for (const container of controls?.containers ?? []) {
    if (!isOpen(container)) continue;
    for (const id of container.hiddenNodeIds) result.set(id, false);
  }

  return result;
}
