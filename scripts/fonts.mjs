// Galmuri 서브셋 폰트를 base64로 SVG <style>에 임베드
// (SVG가 <img>로 로드될 때 외부 리소스는 차단되지만 data: URI는 동작)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const b64 = (p) => readFileSync(join(root, p)).toString('base64');

const cache = {};
export function fontFaceCSS({ bold = false } = {}) {
  const key = bold ? 'rb' : 'r';
  if (!cache[key]) {
    const regular = b64('assets/fonts/Galmuri11.subset.woff2');
    let css = `
@font-face{font-family:'Galmuri11';font-weight:400;src:url(data:font/woff2;base64,${regular}) format('woff2')}`;
    if (bold) {
      const boldB64 = b64('assets/fonts/Galmuri11-Bold.subset.woff2');
      css += `
@font-face{font-family:'Galmuri11';font-weight:700;src:url(data:font/woff2;base64,${boldB64}) format('woff2')}`;
    }
    cache[key] = css;
  }
  return cache[key];
}

export const KFONT = `'Galmuri11','DungGeunMo','NeoDunggeunmo',ui-monospace,monospace`;

// hmtx에서 추출한 글리프별 advance(em 비율) — 타이핑 클리핑/커서 좌표 계산용
const METRICS = JSON.parse(readFileSync(join(root, 'scripts/metrics.json'), 'utf8'));

/** Galmuri11 기준 문자열 렌더 폭(px). 미등록 글자는 한글로 간주(1em). */
export function measure(str, fontSize) {
  let w = 0;
  for (const ch of str) w += METRICS[ch] ?? 1;
  return w * fontSize;
}

/** 문자열의 누적 폭 배열 (0 → 전체). 타이핑 스텝 키프레임용 */
export function cumulativeWidths(str, fontSize) {
  const out = [0];
  let w = 0;
  for (const ch of str) {
    w += (METRICS[ch] ?? 1) * fontSize;
    out.push(w);
  }
  return out;
}
