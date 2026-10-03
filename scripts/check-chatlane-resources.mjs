import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resourceRoot = resolve(repoRoot, 'resources', 'chatlane');
const required = ['ChatLane.exe', 'TinyEXR.Native.dll', 'libSkiaSharp.dll', 'starter.yml', 'LICENSE'];
const missing = required.filter((name) => !existsSync(resolve(resourceRoot, name)));

if (missing.length) {
  console.error(`ChatLane resource check failed: missing ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('ChatLane Windows converter resources are present. Native macOS/Linux converters are not bundled.');
}
