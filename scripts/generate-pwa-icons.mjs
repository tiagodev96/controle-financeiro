// Gera PNGs do PWA a partir do src/app/icon.svg.
//   icon-192.png, icon-512.png (purpose=any)
//   icon-maskable-512.png (com background sólido respeitando safe area Android)
//   apple-touch-icon.png (180x180 pra iOS Safari)
// Rodar: node scripts/generate-pwa-icons.mjs
//
// Maskable: Android Adaptive Icons recortam até 80% do raio — então mantém o
// conteúdo dentro de ~80% e usa o restante como "bleed" da cor do fundo.

import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const sourceSvg = join(repoRoot, 'src', 'app', 'icon.svg');
const outDir = join(repoRoot, 'public', 'icons');

const BG = '#1c1c1a';

async function ensureOutDir() {
  await mkdir(outDir, { recursive: true });
}

async function renderStandard(size, filename) {
  const svg = await readFile(sourceSvg);
  const buffer = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
  await writeFile(join(outDir, filename), buffer);
  console.log(`✓ ${filename} (${size}×${size})`);
}

async function renderMaskable(size, filename) {
  const svg = await readFile(sourceSvg);
  // Renderiza o ícone a 80% do tamanho e centraliza num canvas BG sólido.
  const inner = Math.round(size * 0.8);
  const innerBuffer = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain' })
    .png()
    .toBuffer();

  const offset = Math.round((size - inner) / 2);
  const canvas = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: innerBuffer, top: offset, left: offset }])
    .png()
    .toBuffer();
  await writeFile(join(outDir, filename), canvas);
  console.log(`✓ ${filename} (${size}×${size}, maskable safe area)`);
}

await ensureOutDir();
await renderStandard(192, 'icon-192.png');
await renderStandard(512, 'icon-512.png');
await renderMaskable(512, 'icon-maskable-512.png');
await renderStandard(180, 'apple-touch-icon.png');
console.log('Done.');
