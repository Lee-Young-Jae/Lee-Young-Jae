// ============================================================
//  폰트 서브셋 재생성 — copy.mjs의 collectGlyphs() 기준
//  usage: npm run subset
//  필요: hb-subset CLI(brew install harfbuzz) + 원본 D2Coding TTF
//  (설치 폰트 자동 탐색, 또는 D2CODING_TTF / D2CODING_BOLD_TTF로 경로 지정)
// ============================================================
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compress } from 'wawoff2';
import * as fontkit from 'fontkit';
import { collectGlyphs } from './copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function findFont(envKey, pattern) {
  if (process.env[envKey]) return process.env[envKey];
  const dirs = [join(homedir(), 'Library/Fonts'), '/Library/Fonts', '/System/Library/Fonts'];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    const hit = readdirSync(d).find((f) => pattern.test(f));
    if (hit) return join(d, hit);
  }
  return null;
}

const chars = [...new Set([...collectGlyphs()])];
const work = mkdtempSync(join(tmpdir(), 'd2subset-'));
const unicodesFile = join(work, 'unicodes.txt');
writeFileSync(unicodesFile, chars.map((c) => 'U+' + c.codePointAt(0).toString(16)).join('\n'));

async function build(src, dst) {
  const ttf = join(work, dst + '.ttf');
  // --no-hinting: 힌팅 제거 (SVG에 base64 임베드되므로 용량이 절반으로)
  execFileSync('hb-subset', ['--no-hinting', `--unicodes-file=${unicodesFile}`, '-o', ttf, src]);
  const woff2 = Buffer.from(await compress(readFileSync(ttf)));
  const f = fontkit.create(woff2);
  const missing = chars.filter((ch) => !f.hasGlyphForCodePoint(ch.codePointAt(0)));
  if (missing.length) throw new Error(`서브셋 결과에 글자 누락 (원본 폰트에 없음): ${missing.join('')}`);
  writeFileSync(join(root, 'assets/fonts', dst), woff2);
  console.log(`  ✔ assets/fonts/${dst} ${(woff2.length / 1024).toFixed(1)}KB (${chars.length}자)`);
}

try {
  const regular = findFont('D2CODING_TTF', /^D2Coding(-Ver|\.)/i);
  const bold = findFont('D2CODING_BOLD_TTF', /^D2CodingBold/i);
  if (!regular) throw new Error('D2Coding 원본 TTF를 찾지 못함 — D2CODING_TTF=경로 지정 필요');

  await build(regular, 'D2Coding.subset.woff2');
  if (bold) await build(bold, 'D2Coding-Bold.subset.woff2');
  else console.warn('  ⚠ D2CodingBold 원본 없음 — 기존 Bold 서브셋 유지 (굵은 글씨에 새 글자를 쓰면 tofu 위험)');

  // metrics.json — assertCovered/sanitizeCovered 커버리지 기준 (글자 → 폭 em)
  const srcFont = fontkit.create(readFileSync(regular));
  const metrics = {};
  for (const ch of [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0))) {
    const cp = ch.codePointAt(0);
    if (!srcFont.hasGlyphForCodePoint(cp)) continue;
    metrics[ch] = Math.round((srcFont.glyphForCodePoint(cp).advanceWidth / srcFont.unitsPerEm) * 100) / 100;
  }
  writeFileSync(join(root, 'scripts/metrics.json'), JSON.stringify(metrics));
  console.log(`  ✔ scripts/metrics.json (${Object.keys(metrics).length}자)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
