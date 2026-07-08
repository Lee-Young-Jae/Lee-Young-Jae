// ============================================================
//  ORI TERMINAL — 정적 어셋 빌더
//  usage: node scripts/build-assets.mjs
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { THEMES, line, windowChrome, makeSession, svgDoc, esc, cells } from './theme.mjs';
import { fontFaceCSS, assertCovered } from './fonts.mjs';
import { COPY } from './copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name, svg) => {
  writeFileSync(join(root, 'assets', name), svg);
  console.log('  ✔ assets/' + name, (svg.length / 1024).toFixed(1) + 'KB');
};

const W = 1000;
const FS = 14;
const LH = 22;
const CW = FS / 2;

// ASCII 오리 (ori-fetch 로고) — 물결 위에 떠 있는 오리
const DUCK = [
  '        __',
  '      <(o )____',
  '       (  ._> /',
  '        `----\'',
  '  ~ ~ ~ ~ ~ ~ ~ ~',
];

// ------------------------------------------------------------
// 1) HERO — tmux 창 0:fetch
// ------------------------------------------------------------
function hero(t) {
  const P = 12;
  const bodyX = P + 30;
  const bodyY = P + 30 + 34; // 크롬 타이틀바(30) 아래
  const s = makeSession(t, { x: bodyX, y: bodyY, fs: FS, lh: LH });

  // --- ori-fetch
  s.type(COPY.fetch.cmd, { pause: 0.6 });

  const infoX = bodyX + 250;
  const duckColor = t.amber;
  s.block((x, y) => {
    const duckLines = DUCK.map((ln, i) =>
      `<text x="${x + 8}" y="${y + i * LH}" font-size="15" xml:space="preserve" fill="${i === DUCK.length - 1 ? t.cyan : duckColor}">${esc(ln)}</text>`
    ).join('');
    const rows = COPY.fetch.rows.map(([k, v], i) => {
      const ky = y + i * LH;
      const padded = k + ' '.repeat(Math.max(10 - cells(k), 1));
      return line(t, infoX, ky, [[padded, 'green', true], [assertCovered(v, 'fetch'), null]]);
    }).join('');
    const swY = y + COPY.fetch.rows.length * LH - 8;
    const sw = ['green', 'cyan', 'magenta', 'amber', 'red', 'dim', 'fg', 'faint'].map((c, i) =>
      `<rect x="${infoX + i * 26}" y="${swY}" width="20" height="10" rx="2" fill="${t[c]}"/>`).join('');
    const title = line(t, infoX, y - LH, [[`ori`, 'cyan', true], [' @ ', 'dim'], [COPY.host, 'cyan', true]]);
    const rule = `<rect x="${infoX}" y="${y - LH + 8}" width="${cells('ori @ ' + COPY.host) * CW}" height="1.5" fill="${t.border}"/>`;
    return `${title}${rule}<g transform="translate(0,${LH * 0.9})">${duckLines}${rows}${sw}</g>`;
  }, LH * (COPY.fetch.rows.length + 2.6), { pause: 0.25 });

  // --- cat about.md
  s.gap(0.4);
  s.type(COPY.about.cmd, { pause: 0.7 });
  s.out(COPY.about.lines.map((l) =>
    l.type === 'h'
      ? [[assertCovered(l.text, 'about'), 'magenta', true]]
      : [['  ', null], [assertCovered(l.text, 'about'), null]]
  ), { stagger: 0.12, pause: 0.2 });

  s.gap(0.4);
  s.idle();

  const r = s.render();
  const tmuxH = 26;
  const H = r.endY + 14 + tmuxH + P;
  const chrome = windowChrome(t, {
    w: W, h: H, title: 'ori@github — tmux', activeWin: 0,
    windows: COPY.tmux.windows, host: COPY.host,
  });

  return svgDoc({
    w: W, h: H,
    title: '이영재 — Frontend Developer (ori-fetch)',
    desc: '터미널 세션: ASCII 오리 로고와 프로필 정보, 자기소개가 타이핑됩니다.',
    font: fontFaceCSS('full'),
    style: r.css,
    body: chrome.open + r.svg + chrome.close,
  });
}

// ------------------------------------------------------------
// 2) LIFE — tmux 창 2:life (git log --graph 인생 타임라인)
// ------------------------------------------------------------
function life(t) {
  const P = 12;
  const bodyX = P + 30;
  const bodyY = P + 30 + 34;
  const s = makeSession(t, { x: bodyX, y: bodyY, fs: FS, lh: LH });

  s.type(COPY.life.cmd, { pause: 0.4 });

  // 최근순 일직선 그래프 (브랜치 연출 없이 심플하게)
  const rows = COPY.life.commits.map(([hash, refs, text]) => {
    const refSegs = refs.length
      ? [[' (', 'dim'], ...refs.flatMap((r, j) => {
          const color = r.startsWith('HEAD') ? 'cyan' : 'amber';
          return [...(j ? [[', ', 'dim']] : []), [r, color, true]];
        }), [') ', 'dim']]
      : [[' ', null]];
    return [['* ', 'green'], [hash, 'amber'], ...refSegs, [assertCovered(text, 'life'), null]];
  });
  s.out(rows, { stagger: 0.09, pause: 0.25 });

  s.gap(0.4);
  s.idle();

  const r = s.render();
  const tmuxH = 26;
  const H = r.endY + 14 + tmuxH + P;
  const chrome = windowChrome(t, {
    w: W, h: H, title: 'ori@github — tmux', activeWin: 2,
    windows: COPY.tmux.windows, host: COPY.host,
  });

  return svgDoc({
    w: W, h: H,
    title: 'git log — 2019 입학부터 2026 현재까지',
    desc: '커밋 그래프로 그린 개발자 타임라인',
    font: fontFaceCSS('full'),
    style: r.css,
    body: chrome.open + r.svg + chrome.close,
  });
}

// ------------------------------------------------------------
// 3) FOOTER — tmux detach
// ------------------------------------------------------------
function footer(t) {
  const P = 12;
  const bodyX = P + 30;
  const bodyY = P + 30 + 30;
  const s = makeSession(t, { x: bodyX, y: bodyY, fs: FS, lh: LH });

  s.type(COPY.detach.cmd, { pause: 0.5 });
  s.out([
    [[COPY.detach.out, 'dim']],
    [['# ', 'dim'], [assertCovered(COPY.detach.bye, 'bye'), 'dim']],
  ], { stagger: 0.3, pause: 0.25 });
  s.idle();

  const r = s.render();
  const H = r.endY + 10 + P;
  const chrome = windowChrome(t, {
    w: W, h: H, title: '', activeWin: -1, windows: [], host: '',
  });

  return svgDoc({
    w: W, h: H,
    title: 'tmux detach — 내일 다시',
    desc: '세션에서 분리되었습니다. 잔디는 계속 자랍니다.',
    font: fontFaceCSS('regular'),
    style: r.css,
    body: chrome.open + r.svg + chrome.close,
  });
}

// ------------------------------------------------------------
// 4) 버튼 — ❯ open portfolio ↗
// ------------------------------------------------------------
function button(t, cmd) {
  const H = 54;
  const BW = 306;
  const midY = H / 2 + 5;
  const cmdW = cells(`❯ ${cmd}`) * (13 / 2);
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

// ------------------------------------------------------------
mkdirSync(join(root, 'assets'), { recursive: true });
for (const t of Object.values(THEMES)) {
  console.log(`\n[${t.id}]`);
  out(`hero-${t.id}.svg`, hero(t));
  out(`life-${t.id}.svg`, life(t));
  out(`footer-${t.id}.svg`, footer(t));
  out(`btn-portfolio-${t.id}.svg`, button(t, COPY.buttons.portfolio.cmd));
  out(`btn-blog-${t.id}.svg`, button(t, COPY.buttons.blog.cmd));
  out(`btn-mail-${t.id}.svg`, button(t, COPY.buttons.mail.cmd));
}
console.log('\ndone.');
