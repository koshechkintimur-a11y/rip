/**
 * Генерация PWA-иконок RIP.
 * Использование: node scripts/gen-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, registerFont } from 'canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

// Georgia шрифт
registerFont('C:\\Windows\\Fonts\\georgia.ttf', { family: 'Georgia' });

function drawRip(canvas) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const c = S / 2; // 256

  // 1. Чёрный фон со скруглением
  const r = Math.round(S * 112 / 512); // радиус скругления
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, r);
  ctx.fillStyle = '#000000';
  ctx.fill();

  // 2. Тень под надгробием
  ctx.beginPath();
  ctx.ellipse(c, S * 410 / 512, S * 150 / 512, S * 16 / 512, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#141414';
  ctx.fill();

  // 3. Надгробье
  const t = S * 156 / 512; // left
  const b = S * 410 / 512; // bottom
  const top = S * 220 / 512; // top of arch
  const w = S * 200 / 512; // width (356-156)
  const cx = c; // center
  const aR = w / 2; // arch radius = 100
  ctx.beginPath();
  ctx.moveTo(t, b);
  ctx.lineTo(t, S * 220 / 512);
  // арка: 100px радиус, 180° от 0 до π
  ctx.arc(cx, S * 220 / 512, aR, Math.PI, 0, false);
  ctx.lineTo(t + w, b);
  ctx.closePath();
  ctx.fillStyle = '#2E2E2E';
  ctx.fill();

  // 4. Внутренняя рамка (offset 22px)
  const inset = S * 22 / 512;
  const t2 = t + inset;
  const top2 = S * 226 / 512; // 220 + 6
  const w2 = w - 2 * inset;
  const aR2 = w2 / 2;
  ctx.beginPath();
  ctx.moveTo(t2, b - inset);
  ctx.lineTo(t2, top2);
  ctx.arc(cx, top2, aR2, Math.PI, 0, false);
  ctx.lineTo(t2 + w2, b - inset);
  ctx.closePath();
  ctx.strokeStyle = '#4B4B4B';
  ctx.lineWidth = S * 4 / 512;
  ctx.stroke();

  // 5. Текст RIP
  const fontSize = Math.round(S * 76 / 512);
  ctx.font = `700 ${fontSize}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C8C8C8';
  ctx.letterSpacing = '6px';
  // letterSpacing не поддерживается в canvas, применяем через char spacing
  const text = 'RIP';
  const firstChar = text[0];
  const charX = c - (text.length - 1) * 10; // 10px spacing / 2
  ctx.fillText(text, c, S * 286 / 512);
  // геометрия: чуть выше центра арки

  // 6. Линия земли
  ctx.beginPath();
  ctx.moveTo(S * 86 / 512, b);
  ctx.lineTo(S * 426 / 512, b);
  ctx.strokeStyle = '#1C1C1C';
  ctx.lineWidth = S * 8 / 512;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// --- 512 ---
const cv512 = createCanvas(512, 512);
drawRip(cv512);
const buf512 = cv512.toBuffer('image/png');
fs.writeFileSync(path.join(out, 'icon-512.png'), buf512);
console.log('icon-512.png', buf512.length, 'bytes');

// --- 192 ---
const cv192 = createCanvas(192, 192);
drawRip(cv192);
const buf192 = cv192.toBuffer('image/png');
fs.writeFileSync(path.join(out, 'icon-192.png'), buf192);
console.log('icon-192.png', buf192.length, 'bytes');

// --- maskable 512 (с отступом 20%) ---
const cvMask = createCanvas(512, 512);
const ctxMask = cvMask.getContext('2d');
const pad = 512 * 0.1; // 10% отступ = 80% safe area
ctxMask.save();
ctxMask.translate(pad, pad);
ctxMask.scale(0.8, 0.8);
drawRip(cvMask);
ctxMask.restore();
const bufMask = cvMask.toBuffer('image/png');
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), bufMask);
console.log('icon-maskable-512.png', bufMask.length, 'bytes');

console.log('Готово');