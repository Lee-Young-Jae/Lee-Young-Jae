// D2Coding 서브셋을 base64로 SVG <style>에 임베드
// (SVG가 <img>로 로드될 때 외부 리소스는 차단되지만 data: URI는 동작)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const b64 = (p) => readFileSync(join(root, p)).toString('base64');
const face = (b, weight) =>
  `@font-face{font-family:'D2Coding';font-weight:${weight};src:url(data:font/woff2;base64,${b}) format('woff2')}`;

const cache = {};
/** variant: 'full'(한글 R+B) | 'regular'(한글 R) | 'ascii'(라틴/박스만) */
export function fontFaceCSS(variant = 'full') {
  if (!cache[variant]) {
    cache[variant] = {
      full: () => face(b64('assets/fonts/D2Coding.subset.woff2'), 400)
        + face(b64('assets/fonts/D2Coding-Bold.subset.woff2'), 700),
      regular: () => face(b64('assets/fonts/D2Coding.subset.woff2'), 400),
      ascii: () => face(b64('assets/fonts/D2Coding-ascii.subset.woff2'), '400 700'),
    }[variant]();
  }
  return cache[variant];
}

// 서브셋 커버리지 (여기 없는 한국어 글자는 tofu 위험)
const METRICS = JSON.parse(readFileSync(join(root, 'scripts/metrics.json'), 'utf8'));
export function assertCovered(str, where) {
  for (const ch of str) {
    if (ch.charCodeAt(0) > 127 && !(ch in METRICS)) {
      throw new Error(`서브셋 폰트에 없는 글자 "${ch}" (${where}) — scripts/copy.mjs GLYPH_BUDGET에 추가 후 서브셋 재생성 필요`);
    }
  }
  return str;
}

// 외부 유래 동적 텍스트(레포 설명 등)용 — 미커버 글자·이모지는 조용히 제거 (크론 빌드가 죽으면 안 됨)
export function sanitizeCovered(str) {
  let out = '';
  for (const ch of str) {
    if (ch.charCodeAt(0) <= 127 || ch in METRICS) out += ch;
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}
