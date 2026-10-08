// Resize the supplied artwork without redrawing it. Run after replacing assets/logo.png.
const fs = require('node:fs/promises');
const path = require('node:path');
const { generateImageAsync, generateImageBackgroundAsync, compositeImagesAsync } = require('@expo/image-utils');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'assets/logo.png');

async function exportPng(relativePath, size, padding = 0, backgroundColor = '#FFFFFF') {
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
  await exportPng('assets/icon.png', 1024);
  await exportPng('assets/favicon.png', 64);
  await exportPng('assets/splash-icon.png', 512);
  // The full badge fits inside Android's 66/108 dp safe region. White matches
  // the supplied artwork's corners, while launchers apply their own outer mask.
  await exportPng('assets/android-icon-foreground.png', 1024, 1024 * (1 - 66 / 108) / 2, 'transparent');

  for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const base = 'android/app/src/main/res';
    await exportPng(`${base}/mipmap-${density}/ic_launcher.png`, 48 * scale);
    await exportPng(`${base}/mipmap-${density}/ic_launcher_round.png`, 48 * scale);
    await exportPng(`${base}/mipmap-${density}/ic_launcher_foreground.png`, 108 * scale, 21 * scale, 'transparent');
    // A 120 dp logo centered within the system splash's 288 dp canvas.
    await exportPng(`${base}/drawable-${density}/splashscreen_logo.png`, 288 * scale, 84 * scale, 'transparent');
  }
  console.log('Updated Expo assets and Android launcher/splash densities from assets/logo.png.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
