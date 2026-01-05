import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../apps/web/public/icons');

// Press brand green color
const BRAND_GREEN = '#22C55E';
const DARK_BG = '#0F172A';

// Create SVG for Press "P" logo
function createLogoSvg(size) {
  const fontSize = Math.round(size * 0.65);
  const yOffset = Math.round(size * 0.72);

  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${DARK_BG}" rx="${Math.round(size * 0.2)}"/>
      <text
        x="50%"
        y="${yOffset}"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="${BRAND_GREEN}"
        text-anchor="middle"
      >P</text>
    </svg>
  `;
}

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  console.log('Creating icons directory...');
  await mkdir(iconsDir, { recursive: true });

  for (const size of sizes) {
    const svg = createLogoSvg(size);
    const filename = size === 180
      ? 'apple-touch-icon.png'
      : `icon-${size}x${size}.png`;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(join(iconsDir, filename));

    console.log(`  Created: ${filename}`);
  }

  // Also create favicon.ico (32x32)
  const faviconSvg = createLogoSvg(32);
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(join(iconsDir, 'favicon-32x32.png'));
  console.log('  Created: favicon-32x32.png');

  // Create 16x16 favicon
  const favicon16Svg = createLogoSvg(16);
  await sharp(Buffer.from(favicon16Svg))
    .png()
    .toFile(join(iconsDir, 'favicon-16x16.png'));
  console.log('  Created: favicon-16x16.png');

  console.log('\nDone! Icons generated in apps/web/public/icons/');
}

generateIcons().catch(console.error);
