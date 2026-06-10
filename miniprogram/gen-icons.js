// Generate marker PNG icons for WeChat Mini Program
// Each category gets a colored circle marker

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'miniprogram', 'images');

const markers = {
  'marker-camp': { color: '#2DB86A', size: 24 },
  'marker-hike': { color: '#0A84FF', size: 24 },
  'marker-park': { color: '#FF9F0A', size: 24 },
  'marker-star': { color: '#BF5AF2', size: 24 },
  'marker-food': { color: '#FF453A', size: 24 },
  'marker-custom': { color: '#8E8E93', size: 24 },
};

const tabs = {
  'tab-map': { emoji: false, bg: '#8E8E93', bgOn: '#2DB86A', icon: 'M5,3 L5,15 L9,12 L9,3 Z M9,3 L9,12 L13,15 L13,3 Z' },
  'tab-map-on': { emoji: false, bg: '#2DB86A', icon: 'M5,3 L5,15 L9,12 L9,3 Z M9,3 L9,12 L13,15 L13,3 Z' },
  'tab-list': { emoji: false, bg: '#8E8E93', bgOn: '#2DB86A', icon: 'rect' },
  'tab-list-on': { emoji: false, bg: '#2DB86A', icon: 'rect' },
  'tab-add': { emoji: false, bg: '#8E8E93', bgOn: '#2DB86A', icon: 'plus' },
  'tab-add-on': { emoji: false, bg: '#2DB86A', icon: 'plus' },
  'tab-sync': { emoji: false, bg: '#8E8E93', bgOn: '#2DB86A', icon: 'sync' },
  'tab-sync-on': { emoji: false, bg: '#2DB86A', icon: 'sync' },
};

async function generateMarkers() {
  for (const [name, cfg] of Object.entries(markers)) {
    const s = cfg.size;
    const svg = `<svg width="${s}" height="${s * 1.4}" viewBox="0 0 ${s} ${s * 1.4}">
      <circle cx="${s/2}" cy="${s/2}" r="${s/2 - 1}" fill="${cfg.color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${s/2}" cy="${s/2}" r="${s/4 - 1}" fill="#fff"/>
      <path d="M${s/2},${s} L${s/2 - 3},${s/2 + 2} L${s/2 + 3},${s/2 + 2} Z" fill="${cfg.color}"/>
    </svg>`;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(outDir, name + '.png'));
    console.log(`Generated ${name}.png`);
  }
}

async function generateTabIcons() {
  // Simple tab bar icons - 48x48 SVG
  const iconDefs = {
    'tab-map': `<svg width="48" height="48" viewBox="0 0 48 48"><path d="M8,8 L8,40 L18,34 L18,8 Z M18,8 L18,34 L30,40 L30,8 Z M30,8 L30,40 L40,34 L40,8 Z" fill="none" stroke="#8E8E93" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    'tab-map-on': `<svg width="48" height="48" viewBox="0 0 48 48"><path d="M8,8 L8,40 L18,34 L18,8 Z M18,8 L18,34 L30,40 L30,8 Z M30,8 L30,40 L40,34 L40,8 Z" fill="none" stroke="#2DB86A" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    'tab-list': `<svg width="48" height="48" viewBox="0 0 48 48"><rect x="10" y="10" width="28" height="28" rx="4" fill="none" stroke="#8E8E93" stroke-width="2.5"/><line x1="16" y1="18" x2="32" y2="18" stroke="#8E8E93" stroke-width="2"/><line x1="16" y1="24" x2="32" y2="24" stroke="#8E8E93" stroke-width="2"/><line x1="16" y1="30" x2="32" y2="30" stroke="#8E8E93" stroke-width="2"/></svg>`,
    'tab-list-on': `<svg width="48" height="48" viewBox="0 0 48 48"><rect x="10" y="10" width="28" height="28" rx="4" fill="none" stroke="#2DB86A" stroke-width="2.5"/><line x1="16" y1="18" x2="32" y2="18" stroke="#2DB86A" stroke-width="2"/><line x1="16" y1="24" x2="32" y2="24" stroke="#2DB86A" stroke-width="2"/><line x1="16" y1="30" x2="32" y2="30" stroke="#2DB86A" stroke-width="2"/></svg>`,
    'tab-add': `<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="none" stroke="#8E8E93" stroke-width="2.5"/><line x1="24" y1="16" x2="24" y2="32" stroke="#8E8E93" stroke-width="2.5"/><line x1="16" y1="24" x2="32" y2="24" stroke="#8E8E93" stroke-width="2.5"/></svg>`,
    'tab-add-on': `<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="none" stroke="#2DB86A" stroke-width="2.5"/><line x1="24" y1="16" x2="24" y2="32" stroke="#2DB86A" stroke-width="2.5"/><line x1="16" y1="24" x2="32" y2="24" stroke="#2DB86A" stroke-width="2.5"/></svg>`,
    'tab-sync': `<svg width="48" height="48" viewBox="0 0 48 48"><path d="M14,24 A10,10 0 0,1 34,24 A10,10 0 0,1 14,24" fill="none" stroke="#8E8E93" stroke-width="2.5"/><path d="M34,24 L30,20 M34,24 L30,28" stroke="#8E8E93" stroke-width="2.5" stroke-linecap="round"/><path d="M14,24 L18,28 M14,24 L18,20" stroke="#8E8E93" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    'tab-sync-on': `<svg width="48" height="48" viewBox="0 0 48 48"><path d="M14,24 A10,10 0 0,1 34,24 A10,10 0 0,1 14,24" fill="none" stroke="#2DB86A" stroke-width="2.5"/><path d="M34,24 L30,20 M34,24 L30,28" stroke="#2DB86A" stroke-width="2.5" stroke-linecap="round"/><path d="M14,24 L18,28 M14,24 L18,20" stroke="#2DB86A" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  };

  for (const [name, svg] of Object.entries(iconDefs)) {
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(outDir, name + '.png'));
    console.log(`Generated ${name}.png`);
  }
}

(async () => {
  await generateMarkers();
  await generateTabIcons();
  console.log('All icons generated!');
})();