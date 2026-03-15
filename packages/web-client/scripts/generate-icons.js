import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Standard icon from SVG
const svgBuffer = readFileSync(join(publicDir, 'icon.svg'));
// Maskable icon (with padding for Android safe zone)
const maskableSvgBuffer = readFileSync(join(publicDir, 'icon-maskable.svg'));

const standardSizes = [
  // Android PWA icons
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  // iOS icons
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'apple-touch-icon-152x152.png', size: 152 },
  { name: 'apple-touch-icon-167x167.png', size: 167 },
  { name: 'apple-touch-icon-180x180.png', size: 180 },
  // Favicons
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
];

const maskableSizes = [
  // Android maskable icons
  { name: 'pwa-maskable-192x192.png', size: 192 },
  { name: 'pwa-maskable-512x512.png', size: 512 },
];

const generateIcons = async () => {
  // Generate standard icons
  for (const { name, size } of standardSizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, name));
    console.log(`Generated ${name}`);
  }

  // Generate maskable icons
  for (const { name, size } of maskableSizes) {
    await sharp(maskableSvgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, name));
    console.log(`Generated ${name}`);
  }

  // Generate favicon.ico
  await sharp(svgBuffer)
    .resize(32, 32)
    .toFile(join(publicDir, 'favicon.ico'));
  console.log('Generated favicon.ico');
};

generateIcons().catch(console.error);
