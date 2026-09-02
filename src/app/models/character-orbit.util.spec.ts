import {
  bodyTextureOrbitCaptureKey,
  overlayTextureOrbitCaptureKey,
} from './character-orbit.util';

describe('bodyTextureOrbitCaptureKey', () => {
  it('prefixes the Unity texture GUID', () => {
    expect(bodyTextureOrbitCaptureKey('f282e47c4d66acd4aace982d29714b1d')).toBe(
      'body_texture_f282e47c4d66acd4aace982d29714b1d',
    );
  });

  it('returns empty for blank', () => {
    expect(bodyTextureOrbitCaptureKey('')).toBe('');
    expect(bodyTextureOrbitCaptureKey('   ')).toBe('');
    expect(bodyTextureOrbitCaptureKey(null)).toBe('');
  });
});

describe('overlayTextureOrbitCaptureKey', () => {
  it('prefixes the Unity texture GUID', () => {
    expect(overlayTextureOrbitCaptureKey('0457152b06e950049aa3237467c0a46b')).toBe(
      'overlay_texture_0457152b06e950049aa3237467c0a46b',
    );
  });
});
