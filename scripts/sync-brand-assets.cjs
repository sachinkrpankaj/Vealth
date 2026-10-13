// Resize the supplied artwork without redrawing it. Run after replacing assets/logo.png.
const fs = require('node:fs/promises');
const path = require('node:path');
const { generateImageAsync, generateImageBackgroundAsync, compositeImagesAsync } = require('@expo/image-utils');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'assets/logo.png');

async function exportPng(relativePath, size, padding = 0, backgroundColor = 'transparent') {
  padding = Math.round(padding);
  const artworkSize = size - 2 * padding;
  const { source: png } = await generateImageAsync({ projectRoot }, {
    src: source, width: artworkSize, height: artworkSize, resizeMode: 'contain',
    backgroundColor,
  });
  const output = padding === 0 ? png : await compositeImagesAsync({
    foreground: png,
    background: await generateImageBackgroundAsync({ width: size, height: size, resizeMode: 'contain', backgroundColor }),
    x: padding, y: padding,
  });
  const destination = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, output);
}

async function main() {
  await exportPng('assets/icon.png', 1024, 0, 'transparent');
  await exportPng('assets/favicon.png', 64, 0, 'transparent');
  await exportPng('assets/splash-icon.png', 512, 0, 'transparent');
  // Android launcher artwork is derived separately from the supplied ICO.
  // Preserve its full-bleed assets and adaptive-icon safety padding.

  for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const base = 'android/app/src/main/res';
    // A 120 dp logo centered within the system splash's 288 dp canvas with transparent background.
    await exportPng(`${base}/drawable-${density}/splashscreen_logo.png`, 288 * scale, 84 * scale, 'transparent');
  }
  console.log('Updated shared Expo assets and Android splash densities from assets/logo.png; preserved Android launcher icons.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
