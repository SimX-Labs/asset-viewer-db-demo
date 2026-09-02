import { isLocalDevHost, localFolderDataEnabled } from './runtime-host.util';

describe('runtime-host.util', () => {
  it('treats localhost and loopback as local dev', () => {
    expect(isLocalDevHost('http://localhost:4300')).toBeTrue();
    expect(isLocalDevHost('http://127.0.0.1:4300')).toBeTrue();
    expect(isLocalDevHost('https://[::1]')).toBeTrue();
  });

  it('treats deployed hosts as not local dev', () => {
    expect(isLocalDevHost('https://simx.github.io')).toBeFalse();
    expect(isLocalDevHost('https://asset-viewer.example.com')).toBeFalse();
  });

  it('enables folder-picker packs only on deployed hosts', () => {
    expect(localFolderDataEnabled('http://localhost:4300')).toBeFalse();
    expect(localFolderDataEnabled('https://simx.github.io')).toBeTrue();
  });
});
