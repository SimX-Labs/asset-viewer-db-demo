/**
 * Vial / liquid color override: RRGGBB hex, or a legacy enum name that
 * still maps to a SyringeGenericController material.
 *
 * Hex samples from the materials on tool_medication_syringe_master:
 *   _Color when it is not white, otherwise the albedo texture.
 */
export const LIQUID_COLOR_PRESETS: ReadonlyArray<{
  enumValue: string;
  hex: string;
  label: string;
}> = [
  { enumValue: 'black', hex: '2D2D2D', label: 'Black' },
  { enumValue: 'blue', hex: '9ECCD9', label: 'Blue' },
  { enumValue: 'clear', hex: 'FFFFFF', label: 'Clear' },
  { enumValue: 'darkYellow', hex: '846910', label: 'Dark Yellow' },
  { enumValue: 'frothyBlood', hex: '791C1E', label: 'Frothy Blood' },
  { enumValue: 'milkyWhite', hex: 'FAFAFA', label: 'Milky White' },
  { enumValue: 'pink', hex: 'E89AE6', label: 'Pink' },
  { enumValue: 'red', hex: 'CA3D3D', label: 'Red' },
  { enumValue: 'yellow', hex: 'FCFF3C', label: 'Yellow' },
];

const RGB_HEX = /^#?([0-9a-fA-F]{6})$/;
const COLOR_KEY = /color/i;

export function isRgbHex(value: unknown): value is string {
  return typeof value === 'string' && RGB_HEX.test(value.trim());
}

export function normalizeRgbHex(value: string): string | null {
  const match = RGB_HEX.exec(value.trim());
  return match ? match[1].toUpperCase() : null;
}

export function resolveLiquidColorHex(value: string): string | null {
  const hex = normalizeRgbHex(value);
  if (hex) return hex;
  return LIQUID_COLOR_PRESETS.find((p) => p.enumValue === value)?.hex ?? null;
}

/** CSS `#RRGGBB` for a stored override, or null when it is not a color. */
export function liquidColorCss(
  value: unknown,
  propertyKey = '',
): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (isRgbHex(value)) return `#${normalizeRgbHex(value)}`;
  if (!COLOR_KEY.test(propertyKey)) return null;
  const hex = resolveLiquidColorHex(value);
  return hex ? `#${hex}` : null;
}
