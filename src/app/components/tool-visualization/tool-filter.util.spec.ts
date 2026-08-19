import {
  FILTERED_NODE_ALPHA,
  OVERLAY_NODE_ALPHA,
  colorWithAlpha,
  filterNodeAlpha,
  preferMatchingToolId,
  toolIdMatchesFilter,
} from './tool-filter.util';

describe('tool-filter.util', () => {
  it('treats an empty query as a match for every id', () => {
    expect(toolIdMatchesFilter('Scalpel', '')).toBeTrue();
    expect(toolIdMatchesFilter('Scalpel', '   ')).toBeTrue();
  });

  it('matches tool ids case-insensitively', () => {
    expect(toolIdMatchesFilter('OR-Scalpel', 'scalp')).toBeTrue();
    expect(toolIdMatchesFilter('OR-Scalpel', 'tray')).toBeFalse();
  });

  it('dims only non-matching nodes', () => {
    expect(filterNodeAlpha(true)).toBe(1);
    expect(filterNodeAlpha(false)).toBe(FILTERED_NODE_ALPHA);
  });

  it('scales overlay defaults so filtered nodes stay dimmer', () => {
    expect(filterNodeAlpha(true, OVERLAY_NODE_ALPHA)).toBe(OVERLAY_NODE_ALPHA);
    expect(filterNodeAlpha(false, OVERLAY_NODE_ALPHA)).toBe(
      FILTERED_NODE_ALPHA * OVERLAY_NODE_ALPHA,
    );
  });

  it('prefers a query-matching id when nodes overlap', () => {
    expect(preferMatchingToolId(['Tray', 'OR-Scalpel', 'Forceps'], 'scalp')).toBe(
      'OR-Scalpel',
    );
    expect(preferMatchingToolId(['Tray', 'Forceps'], 'scalp')).toBe('Tray');
  });

  it('applies alpha to hex colors used by vis-network nodes', () => {
    expect(colorWithAlpha('#007CC0', 1)).toBe('#007CC0');
    expect(colorWithAlpha('#007CC0', 0.32)).toBe('rgba(0, 124, 192, 0.32)');
  });
});
