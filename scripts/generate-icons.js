import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Crisp Kabbalah CRM Logo SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#0f766e" />
      <stop offset="60%" stop-color="#115e59" />
      <stop offset="100%" stop-color="#042f2e" />
    </radialGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="50%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#ca8a04" />
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5eead4" />
      <stop offset="100%" stop-color="#14b8a6" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background with subtle rounded container -->
  <rect width="512" height="512" rx="104" fill="url(#bgGrad)" />

  <!-- Outer Sacred Geometry Ring -->
  <circle cx="256" cy="256" r="200" fill="none" stroke="url(#cyanGrad)" stroke-width="3" opacity="0.3" />
  <circle cx="256" cy="256" r="176" fill="none" stroke="url(#goldGrad)" stroke-width="2" stroke-dasharray="8 6" opacity="0.4" />

  <!-- Tree of life connecting lines -->
  <g stroke="url(#cyanGrad)" stroke-width="3.5" opacity="0.6" stroke-linecap="round">
    <!-- Vertical Pillars -->
    <line x1="256" y1="100" x2="256" y2="185" />
    <line x1="256" y1="185" x2="256" y2="275" />
    <line x1="256" y1="275" x2="256" y2="350" />
    <line x1="256" y1="350" x2="256" y2="420" />
    
    <!-- Left & Right Branches -->
    <line x1="256" y1="100" x2="180" y2="160" />
    <line x1="256" y1="100" x2="332" y2="160" />
    
    <line x1="180" y1="160" x2="332" y2="160" />
    <line x1="180" y1="160" x2="180" y2="255" />
    <line x1="332" y1="160" x2="332" y2="255" />
    
    <line x1="180" y1="160" x2="256" y2="275" />
    <line x1="332" y1="160" x2="256" y2="275" />
    
    <line x1="180" y1="255" x2="256" y2="275" />
    <line x1="332" y1="255" x2="256" y2="275" />
    
    <line x1="180" y1="255" x2="195" y2="345" />
    <line x1="332" y1="255" x2="317" y2="345" />
    
    <line x1="195" y1="345" x2="256" y2="350" />
    <line x1="317" y1="345" x2="256" y2="350" />
    
    <line x1="195" y1="345" x2="256" y2="420" />
    <line x1="317" y1="345" x2="256" y2="420" />
  </g>

  <!-- Central Radiant Aura -->
  <circle cx="256" cy="275" r="32" fill="url(#goldGrad)" opacity="0.25" filter="url(#glow)" />

  <!-- Sefirot Nodes -->
  <!-- Keter (Crown) -->
  <circle cx="256" cy="100" r="22" fill="#042f2e" stroke="url(#goldGrad)" stroke-width="4" filter="url(#glow)" />
  <circle cx="256" cy="100" r="10" fill="url(#goldGrad)" />

  <!-- Chochmah & Binah -->
  <circle cx="332" cy="160" r="18" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="3" />
  <circle cx="332" cy="160" r="8" fill="url(#cyanGrad)" />
  <circle cx="180" cy="160" r="18" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="3" />
  <circle cx="180" cy="160" r="8" fill="url(#cyanGrad)" />

  <!-- Da'at / Tiferet Heart -->
  <circle cx="256" cy="185" r="14" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="2.5" opacity="0.8" />
  <circle cx="256" cy="185" r="6" fill="#2dd4bf" />

  <!-- Chesed & Gevurah -->
  <circle cx="332" cy="255" r="18" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="3" />
  <circle cx="332" cy="255" r="8" fill="url(#cyanGrad)" />
  <circle cx="180" cy="255" r="18" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="3" />
  <circle cx="180" cy="255" r="8" fill="url(#cyanGrad)" />

  <!-- Tiferet (Heart & Balance Center) -->
  <circle cx="256" cy="275" r="24" fill="#042f2e" stroke="url(#goldGrad)" stroke-width="4" filter="url(#glow)" />
  <circle cx="256" cy="275" r="12" fill="url(#goldGrad)" />

  <!-- Netzach & Hod -->
  <circle cx="317" cy="345" r="17" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="3" />
  <circle cx="317" cy="345" r="7" fill="url(#cyanGrad)" />
  <circle cx="195" cy="345" r="17" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="3" />
  <circle cx="195" cy="345" r="7" fill="url(#cyanGrad)" />

  <!-- Yesod (Foundation) -->
  <circle cx="256" cy="350" r="19" fill="#042f2e" stroke="url(#cyanGrad)" stroke-width="3.5" />
  <circle cx="256" cy="350" r="8" fill="url(#cyanGrad)" />

  <!-- Malchut (Kingdom / Earth) -->
  <circle cx="256" cy="420" r="22" fill="#042f2e" stroke="url(#goldGrad)" stroke-width="4" />
  <circle cx="256" cy="420" r="10" fill="url(#goldGrad)" />
</svg>`;

// Maskable SVG with safe zone margin (80% circle safe zone, padded)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="mbgGrad" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#0f766e" />
      <stop offset="60%" stop-color="#115e59" />
      <stop offset="100%" stop-color="#042f2e" />
    </radialGradient>
    <linearGradient id="mgold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="50%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#ca8a04" />
    </linearGradient>
    <linearGradient id="mcyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5eead4" />
      <stop offset="100%" stop-color="#14b8a6" />
    </linearGradient>
  </defs>

  <!-- Full-bleed background for maskable adaptive icon -->
  <rect width="512" height="512" fill="url(#mbgGrad)" />

  <!-- Centered Scaled Content (80% safe zone) -->
  <g transform="translate(51.2, 51.2) scale(0.8)">
    <!-- Tree of Life scaled -->
    <circle cx="256" cy="256" r="190" fill="none" stroke="url(#mcyan)" stroke-width="3" opacity="0.3" />
    <g stroke="url(#mcyan)" stroke-width="3.5" opacity="0.6" stroke-linecap="round">
      <line x1="256" y1="100" x2="256" y2="420" />
      <line x1="256" y1="100" x2="180" y2="160" />
      <line x1="256" y1="100" x2="332" y2="160" />
      <line x1="180" y1="160" x2="332" y2="160" />
      <line x1="180" y1="160" x2="180" y2="255" />
      <line x1="332" y1="160" x2="332" y2="255" />
      <line x1="180" y1="160" x2="256" y2="275" />
      <line x1="332" y1="160" x2="256" y2="275" />
      <line x1="180" y1="255" x2="256" y2="275" />
      <line x1="332" y1="255" x2="256" y2="275" />
      <line x1="180" y1="255" x2="195" y2="345" />
      <line x1="332" y1="255" x2="317" y2="345" />
      <line x1="195" y1="345" x2="256" y2="350" />
      <line x1="317" y1="345" x2="256" y2="350" />
      <line x1="195" y1="345" x2="256" y2="420" />
      <line x1="317" y1="345" x2="256" y2="420" />
    </g>
    <!-- Sefirot Nodes -->
    <circle cx="256" cy="100" r="22" fill="#042f2e" stroke="url(#mgold)" stroke-width="4" />
    <circle cx="256" cy="100" r="10" fill="url(#mgold)" />
    <circle cx="332" cy="160" r="18" fill="#042f2e" stroke="url(#mcyan)" stroke-width="3" />
    <circle cx="332" cy="160" r="8" fill="url(#mcyan)" />
    <circle cx="180" cy="160" r="18" fill="#042f2e" stroke="url(#mcyan)" stroke-width="3" />
    <circle cx="180" cy="160" r="8" fill="url(#mcyan)" />
    <circle cx="332" cy="255" r="18" fill="#042f2e" stroke="url(#mcyan)" stroke-width="3" />
    <circle cx="332" cy="255" r="8" fill="url(#mcyan)" />
    <circle cx="180" cy="255" r="18" fill="#042f2e" stroke="url(#mcyan)" stroke-width="3" />
    <circle cx="180" cy="255" r="8" fill="url(#mcyan)" />
    <circle cx="256" cy="275" r="24" fill="#042f2e" stroke="url(#mgold)" stroke-width="4" />
    <circle cx="256" cy="275" r="12" fill="url(#mgold)" />
    <circle cx="317" cy="345" r="17" fill="#042f2e" stroke="url(#mcyan)" stroke-width="3" />
    <circle cx="317" cy="345" r="7" fill="url(#mcyan)" />
    <circle cx="195" cy="345" r="17" fill="#042f2e" stroke="url(#mcyan)" stroke-width="3" />
    <circle cx="195" cy="345" r="7" fill="url(#mcyan)" />
    <circle cx="256" cy="350" r="19" fill="#042f2e" stroke="url(#mcyan)" stroke-width="3.5" />
    <circle cx="256" cy="350" r="8" fill="url(#mcyan)" />
    <circle cx="256" cy="420" r="22" fill="#042f2e" stroke="url(#mgold)" stroke-width="4" />
    <circle cx="256" cy="420" r="10" fill="url(#mgold)" />
  </g>
</svg>`;

async function run() {
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf8');
  console.log('Written icon.svg');

  const svgBuffer = Buffer.from(svgContent);
  const maskableBuffer = Buffer.from(maskableSvg);

  // 192x192 PNG
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 512x512 PNG
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 512x512 maskable PNG
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // favicon.ico (32x32)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated favicon.ico');

  console.log('All icons generated successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
