/**
 * Генерация PNG-иконок RIP без внешних зависимостей (zlib + ручной PNG-энкодер).
 * Использование: node scripts/gen-icons.mjs
 * Рисует чёрный квадрат с белым черепом (пиксель-арт 32x32 → масштаб 16x).
 */
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Череп 16x16 (1 = белый, 2 = глаз, 3 = чёрный контур)
const SKULL = [
  '....11111111....',
  '..111111111111..',
  '.11111111111111.',
  '.11311111111311.',
  '1133331111333311',
  '1133333111333331',
  '1133333111333331',
  '.11333311133311.',
  '..111111111111..',
  '.11111111111111.',
  '1111111111111111',
  '1111..1111..1111',
  '111...111...1111',
  '111..11111..1111',
  '.11111111111111.',
  '..111111111111..',
];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const scale = size / SKULL.length;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      const ch = (SKULL[sy] || '')[sx] || '.';
      const o = rowStart + 1 + x * 4;
      if (ch === '1') { raw[o] = 0xe8; raw[o + 1] = 0xe8; raw[o + 2] = 0xea; raw[o + 3] = 255; }
      else if (ch === '2') { raw[o] = 0x0a; raw[o + 1] = 0x0a; raw[o + 2] = 0x0c; raw[o + 3] = 255; }
      else if (ch === '3') { raw[o] = 0x0a; raw[o + 1] = 0x0a; raw[o + 2] = 0x0c; raw[o + 3] = 255; }
      else { raw[o] = 0x0a; raw[o + 1] = 0x0a; raw[o + 2] = 0x0c; raw[o + 3] = 255; }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), makePng(size));
  console.log(`icon-${size}.png ✓`);
}
fs.writeFileSync(path.join(outDir, 'icon-512-maskable.png'), makePng(512));
console.log('icon-512-maskable.png ✓');
