import { unityClientTextureUrl } from './unity-texture-url.util';

describe('unityClientTextureUrl', () => {
  it('builds an API URL for a Unity Assets/ PNG', () => {
    expect(
      unityClientTextureUrl(
        'Assets/SimX/AssetBundles/Humanoids/skin.png',
        'http://localhost:4301',
      ),
    ).toBe(
      'http://localhost:4301/unity-client/Assets/SimX/AssetBundles/Humanoids/skin.png',
    );
  });

  it('returns null for unresolved, non-Assets, or non-browser formats', () => {
    expect(unityClientTextureUrl(null, 'http://localhost:4301')).toBeNull();
    expect(unityClientTextureUrl('', 'http://localhost:4301')).toBeNull();
    expect(
      unityClientTextureUrl('Packages/com.x/tex.png', 'http://localhost:4301'),
    ).toBeNull();
    expect(
      unityClientTextureUrl(
        'Assets/SimX/AssetBundles/Humanoids/skin.psd',
        'http://localhost:4301',
      ),
    ).toBeNull();
    expect(
      unityClientTextureUrl(
        'Assets/SimX/AssetBundles/Humanoids/skin.tga',
        'http://localhost:4301',
      ),
    ).toBeNull();
  });

  it('encodes path segments', () => {
    expect(
      unityClientTextureUrl('Assets/SimX/Skin Diffuse.png', 'http://localhost:4301'),
    ).toBe('http://localhost:4301/unity-client/Assets/SimX/Skin%20Diffuse.png');
  });
});
