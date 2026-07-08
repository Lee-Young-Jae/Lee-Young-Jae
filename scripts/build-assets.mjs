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
// 2) SEA — tmux 창 3:sea (asciiquarium, 오리 유영)
// ------------------------------------------------------------
function sea(t) {
  const P = 12;
  const bodyX = P + 30;
  const bodyY = P + 30 + 34;
  const s = makeSession(t, { x: bodyX, y: bodyY, fs: FS, lh: LH });
  const dark = t.id === 'dark';

  s.type(COPY.sea.cmd, { pause: 0.5 });

  const AQ = 268; // 수족관 높이
  s.block((x, y) => {
    const bw = W - P * 2; // 창 내부 전체 폭 (winClip이 잘라줌)
    const L = P;          // 창 왼쪽 끝부터 그린다 (fish가 화면 밖에서 진입)
    const surfaceY = y + 14;
    const floorY = y + AQ - 16;
    const mono = (tx, ty, str, fill, cls, extra = '') =>
      `<text${cls ? ` class="${cls}"` : ''} x="${tx}" y="${ty}" font-size="14" xml:space="preserve" fill="${fill}"${extra}>${esc(str)}</text>`;

    // 수면 물결 2겹 (반대 방향 드리프트)
    const waveStr = '~ '.repeat(Math.ceil(bw / 14) + 10);
    const waves =
      mono(L - 56, surfaceY, waveStr, t.cyan, 'wv1') +
      mono(L - 28, surfaceY + 10, waveStr, t.cyan, 'wv2', ' opacity="0.45"');

    // 오리 (수면 위를 천천히 왕복 아님 — 오른쪽으로 무한 유영)
    const duckArt = ['  ,~~.', ' (  o)>', '  \\__)~'];
    const duck = `<g class="drift"><g class="bob">${duckArt.map((ln, i) =>
      mono(0, surfaceY - 26 + i * 13, ln, t.amber)
    ).join('')}${mono(52, surfaceY - 30, '# ' + COPY.sea.quack, t.dim, 'qk')}</g></g>`;

    // 물고기들 (깊이별 속도/방향/색 다르게)
    const fishes = [
      { art: '><(((*>', y: 74, cls: 'fR1', color: t.data.cyan },
      { art: '><>', y: 108, cls: 'fR2', color: t.data.green },
      { art: '<*)))><', y: 138, cls: 'fL1', color: t.data.magenta },
      { art: '<><', y: 170, cls: 'fL2', color: t.dim },
      { art: '><(((°>'.replace('°', 'o'), y: 196, cls: 'fR3', color: t.data.violet },
    ].map((f) => mono(0, y + f.y, f.art, f.color, f.cls)).join('');

    // 기포 (해저에서 수면까지)
    const bubbles = [
      { x: L + 180, d: 0 }, { x: L + 430, d: 2.4 }, { x: L + 640, d: 1.1 }, { x: L + 850, d: 3.6 },
    ].map((b, i) =>
      `<g class="bub" style="animation-delay:${-b.d}s">${mono(b.x, floorY - 6, i % 2 ? 'O' : 'o', t.dim)}</g>`
    ).join('');

    // 수초 (2프레임 스웨이) — 3포기
    const weed = (wx, h, phase) => {
      const rows = Array.from({ length: h }, (_, i) => i);
      const a = rows.map((i) => mono(wx + (i % 2 ? 3 : 0), floorY - 10 - i * 13, i % 2 ? ')' : '(', t.data.green)).join('');
      const b = rows.map((i) => mono(wx + (i % 2 ? 0 : 3), floorY - 10 - i * 13, i % 2 ? '(' : ')', t.data.green)).join('');
      return `<g class="swA" style="animation-delay:${phase}s">${a}</g><g class="swB" style="animation-delay:${phase}s">${b}</g>`;
    };
    const weeds = weed(L + 120, 4, 0) + weed(L + 520, 6, -0.7) + weed(L + 880, 3, -0.3);

    // 해저 모래
    const sand = mono(L - 10, floorY + 10, '.  ,  .  '.repeat(Math.ceil(bw / 63) + 2), t.faint);

    // 크레딧
    const credit = `<text x="${L + bw - 16}" y="${y + 6}" text-anchor="end" font-size="11" fill="${t.faint}">${esc(COPY.sea.credit)}</text>`;

    return waves + duck + fishes + bubbles + weeds + sand + credit;
  }, AQ, { pause: 0.35 });

  const r = s.render();
  const tmuxH = 26;
  const H = r.endY + 6 + tmuxH + P;
  const chrome = windowChrome(t, {
    w: W, h: H, title: 'ori@github — tmux', activeWin: 3,
    windows: COPY.tmux.windows, host: COPY.host,
  });

  const style = r.css + `
.wv1{animation:wv 5s linear infinite}
.wv2{animation:wv 7s linear infinite reverse}
@keyframes wv{from{transform:translateX(0)}to{transform:translateX(-28px)}}
.drift{animation:drift 46s linear infinite}
@keyframes drift{from{transform:translateX(-90px)}to{transform:translateX(${W + 40}px)}}
.bob{animation:bob 1.9s steps(2,jump-none) infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
.qk{opacity:0;animation:qk 12s linear infinite}
@keyframes qk{0%,86%{opacity:0}88%,95%{opacity:1}97%,100%{opacity:0}}
.fR1{animation:swimR 24s linear -6s infinite}
.fR2{animation:swimR 15s linear -11s infinite}
.fR3{animation:swimR 31s linear -20s infinite}
.fL1{animation:swimL 19s linear -3s infinite}
.fL2{animation:swimL 12s linear -8s infinite}
@keyframes swimR{from{transform:translateX(-110px)}to{transform:translateX(${W + 60}px)}}
@keyframes swimL{from{transform:translateX(${W + 60}px)}to{transform:translateX(-110px)}}
.bub{animation:rise 7.5s ease-in infinite}
@keyframes rise{0%{transform:translateY(0);opacity:0}12%{opacity:.85}80%{opacity:.5}100%{transform:translateY(-${AQ - 60}px);opacity:0}}
.swA{animation:swA 1.5s steps(1,end) infinite}
.swB{animation:swB 1.5s steps(1,end) infinite}
@keyframes swA{0%,100%{opacity:1}50%{opacity:0}}
@keyframes swB{0%,100%{opacity:0}50%{opacity:1}}
`;

  return svgDoc({
    w: W, h: H,
    title: 'asciiquarium — 오리가 사는 ASCII 수족관',
    desc: '물결 위에 오리, 물고기 다섯 마리, 기포와 흔들리는 수초.',
    font: fontFaceCSS('full'),
    style,
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
  out(`sea-${t.id}.svg`, sea(t));
  out(`footer-${t.id}.svg`, footer(t));
  out(`btn-portfolio-${t.id}.svg`, button(t, COPY.buttons.portfolio.cmd));
  out(`btn-blog-${t.id}.svg`, button(t, COPY.buttons.blog.cmd));
  out(`btn-mail-${t.id}.svg`, button(t, COPY.buttons.mail.cmd));
}
console.log('\ndone.');
