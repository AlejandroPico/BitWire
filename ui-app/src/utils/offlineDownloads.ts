export type DesktopPlatform = 'windows' | 'macos' | 'linux' | 'unknown';
export type DesktopArchitecture = 'x64' | 'arm64';

const RELEASE_ROOT = 'https://github.com/AlejandroPico/BitWire/releases/download/desktop-latest';

export interface DesktopDownload {
  platform: Exclude<DesktopPlatform, 'unknown'>;
  architecture: DesktopArchitecture | 'universal';
  label: string;
  filename: string;
  note: string;
  url: string;
}

export function detectDesktopPlatform(userAgent = navigator.userAgent, platform = navigator.platform): DesktopPlatform {
  const value = `${platform} ${userAgent}`.toLowerCase();
  if (/windows|win32|win64/.test(value)) return 'windows';
  if (/macintosh|mac os|macintel/.test(value)) return 'macos';
  if (/linux|x11/.test(value) && !/android/.test(value)) return 'linux';
  return 'unknown';
}

export function detectDesktopArchitecture(userAgent = navigator.userAgent): DesktopArchitecture {
  return /arm64|aarch64/.test(userAgent.toLowerCase()) ? 'arm64' : 'x64';
}

export function desktopDownloads(architecture: DesktopArchitecture = detectDesktopArchitecture()): DesktopDownload[] {
  const windowsFile = `BitWire-Windows-${architecture}.exe`;
  const linuxFile = `BitWire-Linux-${architecture}.AppImage`;
  const macFile = 'BitWire-macOS-universal.zip';
  return [
    { platform: 'windows', architecture, label: `Windows ${architecture === 'arm64' ? 'ARM64' : '64 bits'}`, filename: windowsFile, note: 'Ejecutable portable .exe · no instala nada', url: `${RELEASE_ROOT}/${windowsFile}` },
    { platform: 'macos', architecture: 'universal', label: 'macOS universal', filename: macFile, note: 'Aplicación portable para Intel y Apple Silicon', url: `${RELEASE_ROOT}/${macFile}` },
    { platform: 'linux', architecture, label: `Linux ${architecture === 'arm64' ? 'ARM64' : '64 bits'}`, filename: linuxFile, note: 'AppImage autocontenida · un solo archivo', url: `${RELEASE_ROOT}/${linuxFile}` },
  ];
}

export function recommendedDesktopDownload(userAgent = navigator.userAgent, platform = navigator.platform) {
  const detectedPlatform = detectDesktopPlatform(userAgent, platform);
  const downloads = desktopDownloads(detectDesktopArchitecture(userAgent));
  return { detectedPlatform, downloads, recommended: downloads.find(item => item.platform === detectedPlatform) };
}
