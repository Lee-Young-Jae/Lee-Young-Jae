// ============================================================
//  ORI TERMINAL — 정적 어셋 빌더 (링크 버튼만)
//  usage: node scripts/build-assets.mjs
//  메인 세션 SVG는 render-stats.mjs가 그린다.
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { THEMES, line, svgDoc, cells } from './theme.mjs';
import { fontFaceCSS } from './fonts.mjs';
import { COPY } from './copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name, svg) => {
  writeFileSync(join(root, 'assets', name), svg);
  console.log('  ✔ assets/' + name, (svg.length / 1024).toFixed(1) + 'KB');
};

// 버튼 — ❯ open portfolio ↗
function button(t, cmd) {
  const H = 54;
  const BW = 306;
  const midY = H / 2 + 5;
  return svgDoc({
    w: BW, h: H,
    title: cmd,
    desc: `${cmd} 링크`,
    font: fontFaceCSS('ascii'),
    style: `.arr{animation:nudge 1.6s ease-in-out infinite}
@keyframes nudge{0%,100%{transform:translate(0,0)}50%{transform:translate(2.5px,-2.5px)}}`,
    body: `
<rect x="1.5" y="1.5" width="${BW - 3}" height="${H - 3}" rx="10" fill="${t.chrome}"/>
<rect x="1.5" y="1.5" width="${BW - 3}" height="${H - 3}" rx="10" fill="none" stroke="${t.border}" stroke-width="1.5"/>
${line(t, 22, midY, [['❯ ', 'green', true], [cmd, null, true]], { fs: 13 })}
<g class="arr">${line(t, BW - 34, midY, [['↗', 'cyan', true]], { fs: 14 })}</g>
`,
  });
}

mkdirSync(join(root, 'assets'), { recursive: true });
for (const t of Object.values(THEMES)) {
  console.log(`\n[${t.id}]`);
  out(`btn-portfolio-${t.id}.svg`, button(t, COPY.buttons.portfolio.cmd));
  out(`btn-blog-${t.id}.svg`, button(t, COPY.buttons.blog.cmd));
  out(`btn-mail-${t.id}.svg`, button(t, COPY.buttons.mail.cmd));
}
console.log('\ndone.');
