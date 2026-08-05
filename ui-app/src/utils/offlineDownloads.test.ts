import { describe, expect, it } from 'vitest';
import { desktopDownloads, detectDesktopArchitecture, detectDesktopPlatform, recommendedDesktopDownload } from './offlineDownloads';

describe('descargas offline', () => {
  it('detecta Windows', () => expect(detectDesktopPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')).toBe('windows'));
  it('detecta macOS', () => expect(detectDesktopPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel')).toBe('macos'));
  it('detecta Linux sin confundir Android', () => {
    expect(detectDesktopPlatform('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64')).toBe('linux');
    expect(detectDesktopPlatform('Mozilla/5.0 (Linux; Android 15)', 'Linux armv8l')).toBe('unknown');
  });
  it('distingue ARM64', () => expect(detectDesktopArchitecture('Mozilla/5.0 Linux aarch64')).toBe('arm64'));
  it('recomienda el artefacto portable correcto', () => {
    const result = recommendedDesktopDownload('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32');
    expect(result.recommended?.filename).toBe('BitWire-Windows-x64.exe');
    expect(desktopDownloads('arm64').find(item => item.platform === 'linux')?.filename).toBe('BitWire-Linux-arm64.AppImage');
  });
});
