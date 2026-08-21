import {
  isRgbHex,
  liquidColorCss,
  normalizeRgbHex,
  resolveLiquidColorHex,
} from './liquid-color.util';

describe('liquid-color.util', () => {
  it('accepts rrggbb with or without a hash', () => {
    expect(isRgbHex('CA3D3D')).toBeTrue();
    expect(isRgbHex('#ca3d3d')).toBeTrue();
    expect(isRgbHex('red')).toBeFalse();
    expect(isRgbHex('CA3D3DFF')).toBeFalse();
  });

  it('normalizes to uppercase RRGGBB without a hash', () => {
    expect(normalizeRgbHex('#ca3d3d')).toBe('CA3D3D');
    expect(normalizeRgbHex('9eccd9')).toBe('9ECCD9');
  });

  it('maps legacy enum names to syringe material hexes', () => {
    expect(resolveLiquidColorHex('red')).toBe('CA3D3D');
    expect(resolveLiquidColorHex('blue')).toBe('9ECCD9');
    expect(resolveLiquidColorHex('yellow')).toBe('FCFF3C');
    expect(resolveLiquidColorHex('notAColor')).toBeNull();
  });

  it('returns CSS only for hex strings or Color-keyed enum names', () => {
    expect(liquidColorCss('CA3D3D')).toBe('#CA3D3D');
    expect(liquidColorCss('red', 'vialLiquidColorOverride')).toBe('#CA3D3D');
    expect(liquidColorCss('red', 'name')).toBeNull();
    expect(liquidColorCss(null, 'vialLiquidColorOverride')).toBeNull();
  });
});
