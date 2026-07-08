// ============================================================
//  ORI ARCADE — 정적 어셋 빌더
//  usage: node scripts/build-assets.mjs
//  assets/*.svg (dark/light 각 1벌) 를 전부 다시 그린다.
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  THEMES, FONT5, DUCK_FRAMES, DUCK_COLORS,
  bitmapRects, pixelText, pixelTextWidth, scanlines, pixelFrame, starfield, svgDoc, esc,
} from './theme.mjs';
import { fontFaceCSS, KFONT, measure, cumulativeWidths } from './fonts.mjs';
import { COPY } from './copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name, svg) => {
  writeFileSync(join(root, 'assets', name), svg);
  console.log('  ✔ assets/' + name, (svg.length / 1024).toFixed(1) + 'KB');
};

const W = 1000;

// ------------------------------------------------------------
// 공용 조각
// ------------------------------------------------------------

/** 걷는 오리 (16s 순환, 2프레임 뒤뚱, 55% 지점에서 "꽥!") */
function walkingDuck(t, groundY, { cell = 3, dur = 16, quack = true } = {}) {
  const h = DUCK_FRAMES[0].length * cell;
  const frames = DUCK_FRAMES.map(
    (f, i) => `<g class="df${i}">${bitmapRects(f, { cell, colors: DUCK_COLORS })}</g>`
  ).join('');
  const bubble = quack
    ? `<g class="quack">
        <rect x="${17 * cell}" y="${-14}" width="46" height="22" fill="${t.ink}"/>
        <rect x="${17 * cell + 2}" y="${-12}" width="42" height="18" fill="${t.screen}"/>
        <rect x="${15 * cell}" y="${2}" width="6" height="4" fill="${t.ink}"/>
        <text x="${17 * cell + 23}" y="${3}" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="12" fill="${t.ink}">꽥!</text>
      </g>`
    : '';
  return `<g class="duckwalk" style="animation-duration:${dur}s"><g transform="translate(0,${groundY - h})">${frames}${bubble}</g></g>`;
}

const duckCSS = (dur = 16) => `
.duckwalk{animation:walk ${dur}s linear infinite}
@keyframes walk{from{transform:translateX(-70px)}to{transform:translateX(${W + 20}px)}}
.df0{animation:fA .36s steps(1,end) infinite}
.df1{animation:fB .36s steps(1,end) infinite}
@keyframes fA{0%,100%{opacity:1}50%{opacity:0}}
@keyframes fB{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
.quack{opacity:0;animation:qk ${dur}s linear infinite}
@keyframes qk{0%,54%{opacity:0}55%,64%{opacity:1}65%,100%{opacity:0}}
`;

/** 아케이드 하드컷 블링크 */
const blinkCSS = `.blink{animation:bl 1.1s steps(2,jump-none) infinite}@keyframes bl{0%{opacity:1}50%{opacity:.08}100%{opacity:1}}`;

// ------------------------------------------------------------
// 1) HERO
// ------------------------------------------------------------
function hero(t) {
  const H = 380;
  const dark = t.id === 'dark';

  // ---- 헤드라인: LEE YOUNGJAE (5×7 rect 픽셀 — 폰트 의존성 0)
  const name = 'LEE YOUNGJAE';
  const cell = 8;
  const nameW = pixelTextWidth(name, cell, 1);
  const nameX = (W - nameW) / 2;
  const nameY = 78;
  const letterCls = (i) => `hl hl${i}`;
  const headline = pixelText(name, { x: nameX, y: nameY, cell, fill: dark ? t.neon : t.ink, classFn: letterCls });
  // 인쇄 핀트 어긋남(light) / 포스포 글로우(dark)
  const headlineFx = dark
    ? `<g filter="url(#glow)" opacity="0.8">${pixelText(name, { x: nameX, y: nameY, cell, fill: t.neon })}</g>`
    : `<g opacity="0.85">${pixelText(name, { x: nameX - 3, y: nameY - 3, cell, fill: t.neonMagenta })}</g>
       <g opacity="0.85">${pixelText(name, { x: nameX + 3, y: nameY + 3, cell, fill: t.neonCyan })}</g>`;

  // 글자별 웨이브 시머
  const shimmer = [...name].map((_, i) =>
    `.hl${i}{animation:sh 3.6s ease-in-out ${(i * 0.14).toFixed(2)}s infinite}`
  ).join('');

  // ---- 서브 타이틀
  const role = 'FRONTEND DEVELOPER';
  const roleW = pixelTextWidth(role, 3, 1);
  const roleX = (W - roleW) / 2;
  const roleY = 152;

  // ---- 타이핑 라인 (Galmuri, 글리프 폭 기반 스텝 키프레임)
  const typing = COPY.hero.typing;
  const tFS = 20;
  const tW = measure(typing, tFS);
  const tX = (W - tW) / 2;
  const tY = 210;
  const cums = cumulativeWidths(typing, tFS);
  const steps = cums.length - 1;
  const typeDur = (steps * 0.075).toFixed(2);
  const clipKF = cums.map((w, i) =>
    `${((i / steps) * 100).toFixed(2)}%{width:${w.toFixed(1)}px}`
  ).join('');
  const caretKF = cums.map((w, i) =>
    `${((i / steps) * 100).toFixed(2)}%{transform:translateX(${w.toFixed(1)}px)}`
  ).join('');

  // ---- 스카이라인 (결정적 배치)
  const groundY = 344;
  const bldg = [
    [18, 74, 58], [86, 40, 96], [138, 58, 70], [210, 46, 110], [268, 66, 52],
    [348, 38, 88], [398, 54, 64], [466, 44, 120], [524, 62, 78], [600, 40, 100],
    [652, 58, 58], [724, 46, 92], [782, 40, 68], [836, 60, 106], [910, 44, 76], [962, 30, 54],
  ];
  const bldgColor = dark ? '#0d1526' : '#e6dcc6';
  const winColors = dark ? [t.neonAmber, t.neonCyan, t.faint] : ['#c9b98f', '#b8a97e', '#d5c8a8'];
  let winSeed = 13;
  const rndW = () => ((winSeed = (winSeed * 16807) % 2147483647) / 2147483647);
  const skyline = bldg.map(([x, w, h], bi) => {
    const wins = [];
    for (let wy = groundY - h + 8; wy < groundY - 8; wy += 12) {
      for (let wx = x + 5; wx < x + w - 6; wx += 10) {
        if (rndW() > 0.62) {
          const c = winColors[Math.floor(rndW() * winColors.length)];
          const cls = dark && rndW() > 0.75 ? ` class="winkle" style="animation-delay:${(-rndW() * 8).toFixed(1)}s"` : '';
          wins.push(`<rect x="${wx}" y="${wy}" width="4" height="5" fill="${c}" opacity="0.9"${cls}/>`);
        }
      }
    }
    // 옥상 안테나
    const antenna = bi % 5 === 2 ? `<rect x="${x + w / 2}" y="${groundY - h - 12}" width="2" height="12" fill="${bldgColor}"/><rect x="${x + w / 2 - 1}" y="${groundY - h - 14}" width="4" height="3" fill="${dark ? t.neonMagenta : '#c9b98f'}" class="${dark ? 'winkle' : ''}"/>` : '';
    return `<rect x="${x}" y="${groundY - h}" width="${w}" height="${h}" fill="${bldgColor}"/>${antenna}${wins.join('')}`;
  }).join('');

  // ---- 상단 HUD
  const hudY = 22;
  const hud = `
    <g class="blink">${pixelText('1UP', { x: 30, y: hudY, cell: 3, fill: dark ? t.neonMagenta : t.neonMagenta })}</g>
    ${pixelText('ORI', { x: 30, y: hudY + 30, cell: 3, fill: t.muted })}
    ${pixelText('HI-SCORE', { x: (W - pixelTextWidth('HI-SCORE', 3, 1)) / 2, y: hudY, cell: 3, fill: t.muted })}
    ${pixelText('9999999', { x: (W - pixelTextWidth('9999999', 3, 1)) / 2, y: hudY + 30, cell: 3, fill: dark ? t.neonAmber : t.neonAmber })}
    ${pixelText('CREDIT ∞', { x: W - 30 - pixelTextWidth('CREDIT ∞', 3, 1), y: hudY, cell: 3, fill: t.muted })}
  `;

  // ---- PRESS START
  const press = 'PRESS ▶ START';
  const pressW = pixelTextWidth(press, 4, 1);

  const style = `
${fontFaceCSS()}
.tw{animation:tw 3s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.15}50%{opacity:1}}
.winkle{animation:wk 4s steps(2,jump-none) infinite}
@keyframes wk{0%,100%{opacity:.9}50%{opacity:.15}}
${shimmer}
@keyframes sh{0%,100%{opacity:1}12%{opacity:.55}}
.typebox{animation:type ${typeDur}s steps(1,end) 1.1s both}
@keyframes type{${clipKF}}
.caret{animation:caret ${typeDur}s steps(1,end) 1.1s both, cblink .9s steps(2,jump-none) ${(1.1 + Number(typeDur))}s infinite}
@keyframes caret{${caretKF}}
@keyframes cblink{0%{opacity:1}50%{opacity:0}100%{opacity:1}}
.sub{animation:fadeup .8s ease-out ${(1.4 + Number(typeDur)).toFixed(1)}s both}
@keyframes fadeup{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
${blinkCSS}
.pressg{animation:bl 1.4s steps(2,jump-none) infinite}
${duckCSS()}
`;

  const body = `
<defs>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="4"/>
  </filter>
  <radialGradient id="vig" cx="50%" cy="42%" r="75%">
    <stop offset="60%" stop-color="${t.screen}" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="${dark ? 0.55 : 0.06}"/>
  </radialGradient>
  <pattern id="halftone" width="7" height="7" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="1.6" height="1.6" fill="#e8e0cf"/>
  </pattern>
  <clipPath id="screenClip"><path d="${pixelFrame(6, 6, W - 12, H - 12, 16)}"/></clipPath>
</defs>

<path d="${pixelFrame(0, 0, W, H, 16)}" fill="${dark ? '#02040a' : '#efe8d8'}"/>
<g clip-path="url(#screenClip)">
  <rect width="${W}" height="${H}" fill="${t.screen}"/>
  ${dark ? '' : `<rect width="${W}" height="${H}" fill="url(#halftone)"/>`}
  ${starfield(t, W, H)}
  ${skyline}
  <rect x="0" y="${groundY}" width="${W}" height="2" fill="${dark ? '#1c2740' : t.bezelHi}"/>
  <rect x="0" y="${groundY + 2}" width="${W}" height="${H - groundY - 2}" fill="${dark ? '#04060d' : '#f2ead9'}"/>

  ${hud}
  ${headlineFx}
  ${headline}
  <rect x="${roleX - 46}" y="${roleY + 9}" width="34" height="3" fill="${dark ? t.neonCyan : t.neonCyan}"/>
  ${pixelText(role, { x: roleX, y: roleY, cell: 3, fill: dark ? t.neonCyan : t.neonCyan })}
  <rect x="${roleX + roleW + 12}" y="${roleY + 9}" width="34" height="3" fill="${dark ? t.neonCyan : t.neonCyan}"/>

  <g>
    <clipPath id="typeClip"><rect class="typebox" x="${tX}" y="${tY - tFS}" width="${tW}" height="${tFS * 1.6}"/></clipPath>
    <text x="${tX}" y="${tY}" font-family=${JSON.stringify(KFONT)} font-size="${tFS}" fill="${t.ink}" clip-path="url(#typeClip)">${esc(typing)}</text>
    <g class="caret"><rect x="${tX + 2}" y="${tY - tFS + 3}" width="3" height="${tFS}" fill="${t.neon}"/></g>
  </g>
  <text class="sub" x="${W / 2}" y="252" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="13" fill="${t.muted}">${esc(COPY.hero.sub)}</text>

  <g class="pressg">${pixelText(press, { x: (W - pressW) / 2, y: 268, cell: 4, fill: t.neonAmber })}</g>

  ${walkingDuck(t, groundY)}

  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  ${dark ? scanlines(t, W, H) : ''}
  ${dark ? `<polygon points="0,0 260,0 60,${H} 0,${H}" fill="#ffffff" opacity="0.018"/>` : ''}
</g>
<path d="${pixelFrame(3, 3, W - 6, H - 6, 16)}" fill="none" stroke="${t.bezel}" stroke-width="3"/>
<path d="${pixelFrame(0, 0, W, H, 16)}" fill="none" stroke="${dark ? t.bezelHi : t.bezelHi}" stroke-width="1.5" opacity="0.8"/>
`;

  return svgDoc({
    w: W, h: H,
    title: 'LEE YOUNGJAE — FRONTEND DEVELOPER',
    desc: '픽셀 아케이드 스타일 인트로. 오리가 걸어다니는 CRT 화면.',
    style, body,
  });
}

// ------------------------------------------------------------
// 2) 메뉴 버튼
// ------------------------------------------------------------
function menuButton(t, { en, kr, w = 300 }) {
  const H = 66;
  const enW = pixelTextWidth(en, 3, 1);
  const style = `
${fontFaceCSS()}
.arrow{animation:nudge 1s steps(2,jump-none) infinite}
@keyframes nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
`;
  const body = `
<path d="${pixelFrame(1, 1, w - 2, H - 2, 10)}" fill="${t.card}"/>
<path d="${pixelFrame(1, 1, w - 2, H - 2, 10)}" fill="none" stroke="${t.bezelHi}" stroke-width="2"/>
<g class="arrow">${bitmapRects(FONT5['▶'], { x: 24, y: 18, cell: 3, fill: t.neon })}</g>
${pixelText(en, { x: 52, y: 15, cell: 3, fill: t.ink })}
<text x="52" y="52" font-family=${JSON.stringify(KFONT)} font-size="12" fill="${t.muted}">${esc(kr)}</text>
<rect x="${w - 26}" y="${H / 2 - 6}" width="4" height="4" fill="${t.neonMagenta}"/>
<rect x="${w - 18}" y="${H / 2 - 6}" width="4" height="4" fill="${t.neonAmber}"/>
<rect x="${w - 22}" y="${H / 2 + 2}" width="4" height="4" fill="${t.neonCyan}"/>
`;
  return svgDoc({ w, h: H, title: en, desc: kr, style, body });
}

// ------------------------------------------------------------
// 3) 스테이지 배너 (+ 코인 스핀)
// ------------------------------------------------------------
const COIN_FRAMES = [
  ['..ooooo..', '.ooooooo.', 'oooo.oooo', 'ooo..oooo', 'oooo.oooo', 'oooo.oooo', 'oooo.oooo', 'ooo...ooo', '.ooooooo.', '..ooooo..'],
  ['...ooo...', '..ooooo..', '..oo.oo..', '..o..oo..', '..oo.oo..', '..oo.oo..', '..oo.oo..', '..o...o..', '..ooooo..', '...ooo...'],
  ['....o....', '...ooo...', '...ooo...', '...ooo...', '...ooo...', '...ooo...', '...ooo...', '...ooo...', '...ooo...', '....o....'],
];

function coin(t, x, y, phase = 0, cell = 2.4) {
  const frames = COIN_FRAMES.map((f, i) =>
    `<g class="cf${i}" style="animation-delay:${(-phase).toFixed(2)}s">${bitmapRects(f, { cell, colors: { o: t.neonAmber, '.': null } })}</g>`
  ).join('');
  return `<g transform="translate(${x},${y})">${frames}</g>`;
}

const coinCSS = `
.cf0{animation:c0 .9s steps(1,end) infinite}
.cf1{animation:c1 .9s steps(1,end) infinite}
.cf2{animation:c2 .9s steps(1,end) infinite}
@keyframes c0{0%,100%{opacity:1}33%,99%{opacity:0}}
@keyframes c1{0%{opacity:0}33%{opacity:1}66%,100%{opacity:0}}
@keyframes c2{0%,65%{opacity:0}66%{opacity:1}100%{opacity:0}}
`;

function stageBanner(t, { num, en, kr }) {
  const H = 88;
  const chipText = num === 'BONUS' ? 'BONUS' : `STAGE ${num}`;
  const chipW = pixelTextWidth(chipText, 3, 1) + 36;
  const style = `${fontFaceCSS()}${coinCSS}${blinkCSS}`;
  const titleX = 40 + chipW + 26;
  const body = `
<rect x="0" y="12" width="${W}" height="${H - 24}" fill="${t.card}"/>
<rect x="0" y="12" width="${W}" height="2" fill="${t.bezelHi}"/>
<rect x="0" y="${H - 14}" width="${W}" height="2" fill="${t.bezelHi}"/>
<rect x="0" y="12" width="6" height="${H - 24}" fill="${t.neon}"/>
<path d="${pixelFrame(40, 24, chipW, 40, 8)}" fill="${t.well}"/>
<path d="${pixelFrame(40, 24, chipW, 40, 8)}" fill="none" stroke="${t.neon}" stroke-width="2"/>
${pixelText(chipText, { x: 40 + 18, y: 34, cell: 3, fill: t.neon })}
${pixelText(en, { x: titleX, y: 19, cell: 4, fill: t.ink })}
<text x="${titleX + 2}" y="${H - 21}" font-family=${JSON.stringify(KFONT)} font-size="12" fill="${t.muted}">${esc(kr)}</text>
${coin(t, W - 140, 32, 0)}
${coin(t, W - 100, 32, 0.3)}
${coin(t, W - 60, 32, 0.6)}
`;
  return svgDoc({ w: W, h: H, title: `${chipText} — ${en}`, desc: kr, style, body });
}

// ------------------------------------------------------------
// 4) 장비창 (인벤토리)
// ------------------------------------------------------------
const ICONS = {
  react: {
    grid: [
      'c....ccc....c', '....c...c....', '...c.....c...', '..c.......c..',
      '..c...c...c..', '..c..ccc..c..', '..c...c...c..',
      '..c.......c..', '...c.....c...', '....c...c....', 'c....ccc....c',
    ],
    map: (t) => ({ c: t.id === 'dark' ? '#56c8ff' : '#1178a5' }),
  },
  next: {
    grid: [
      '....ooooo....', '..oo.....oo..', '.o.........o.', '.o..n...n..o.',
      'o...nn..n...o', 'o...n.n.n...o', 'o...n..nn...o', 'o...n...n...o',
      '.o.........o.', '..oo.....oo..', '....ooooo....',
    ],
    map: (t) => ({ o: t.ink, n: t.ink }),
  },
  ts: {
    grid: [
      'sssssssssssss', 'sssssssssssss', 'sssssssssssss', 'sssssssssssss',
      'sssssssssssss', 'sssssssssssss', 'sssssssssssss', 'sssssssssssss',
      'sssssssssssss', 'sssssssssssss', 'sssssssssssss',
    ],
    map: (t) => ({ s: t.id === 'dark' ? '#2e9ad8' : '#0f7fa8' }),
    // 사각 배경 위에 FONT5 'T','S'를 얹는다 (post 렌더)
    post: (t, x, y, cell) => {
      const ink = t.id === 'dark' ? '#070a12' : '#fdf9f0';
      return bitmapRects(FONT5.T, { x: x + cell * 1.2, y: y + cell * 3, cell: cell * 0.55, fill: ink })
        + bitmapRects(FONT5.S, { x: x + cell * 6.9, y: y + cell * 3, cell: cell * 0.55, fill: ink });
    },
  },
  html: {
    grid: [
      'hhhhhhhhhhhhh', 'hhhhhhhhhhhhh', 'hhhWWWWWWWhhh', 'hhhWhhhhhhhhh',
      '.hhWWWWWWWhh.', '.hhhhhhhWWhh.', '..hWWWWWWWh..', '..hhhhhhhhh..',
      '...hhhhhhh...', '....hhhhh....', '.....hhh.....',
    ],
    map: (t) => ({ h: t.id === 'dark' ? '#e0447e' : '#c9366d', W: t.id === 'dark' ? '#070a12' : '#fdf9f0' }),
  },
  css: {
    grid: [
      '..vv.....vv..', '..v.......v..', '..v.......v..', '..v.......v..',
      '.vv.......vv.', '..v.......v..', '..v.......v..', '..v.......v..',
      '..vv.....vv..', '.............', '.............',
    ],
    map: (t) => ({ v: t.id === 'dark' ? '#9d71f2' : '#7d4fc9' }),
  },
  nest: {
    grid: [
      '.n.........n.', '.nn.......nn.', '.nnn.....nnn.', '.nnnnnnnnnnn.',
      'nnnnnnnnnnnnn', 'nnKnnnnnnnKnn', 'nnnnnnnnnnnnn', 'nnnnnKKKnnnnn',
      '.nnnnnnnnnnn.', '..nnnnnnnnn..', '...nnnnnnn...',
    ],
    map: (t) => ({ n: t.id === 'dark' ? '#ff6b9d' : '#d23f77', K: t.id === 'dark' ? '#070a12' : '#fdf9f0' }),
  },
  claude: {
    grid: [
      'a.....a.....a', '.a....a....a.', '..a...a...a..', '...a..a..a...',
      '....a.a.a....', '.....aaa.....', 'aaaaaa.aaaaaa', '.....aaa.....',
      '....a.a.a....', '...a..a..a...', '..a...a...a..',
    ],
    map: () => ({ a: '#d97757' }),
  },
  coffee: {
    grid: [
      '.............', '.............', '.............', '.mmmmmmmmm...',
      '.mfffffffm.m.', '.mfffffffmmm.', '.mfffffffm.m.', '.mfffffffmm..',
      '..mmmmmmm....', '.............', '.............',
    ],
    map: (t) => ({ m: t.ink, f: t.id === 'dark' ? '#c98500' : '#a86a00' }),
  },
};

function inventory(t) {
  const H = 460;
  const dark = t.id === 'dark';
  const rarity = {
    MYTHIC: t.neonMagenta,
    LEGENDARY: t.neonAmber,
    EPIC: dark ? '#9d71f2' : '#7d4fc9',
    RARE: dark ? '#56c8ff' : '#1178a5',
    COMMON: t.muted,
  };
  const items = [
    { icon: 'react', slot: 'WEAPON', name: 'React +9', kr: '주무기 — 손에 제일 익음', tier: 'LEGENDARY' },
    { icon: 'next', slot: 'OFF-HAND', name: 'Next.js +7', kr: '보조무기 — 풀스택 콤보', tier: 'EPIC' },
    { icon: 'ts', slot: 'ARMOR', name: 'TypeScript', kr: '방어구 — 런타임 에러 방어', tier: 'EPIC' },
    { icon: 'html', slot: 'HELM', name: 'HTML5', kr: '투구 — 시맨틱 가호', tier: 'RARE' },
    { icon: 'css', slot: 'GLOVES', name: 'CSS3', kr: '장갑 — 픽셀 조각용', tier: 'RARE' },
    { icon: 'nest', slot: 'SUMMON', name: 'NestJS', kr: '소환수 — 백엔드 지원사격', tier: 'EPIC' },
    { icon: 'claude', slot: 'SCROLL', name: 'Claude Code', kr: '주문서 — 에이전트 하네스', tier: 'MYTHIC' },
    { icon: 'coffee', slot: 'POTION', name: 'Coffee ∞', kr: '물약 — 재사용 대기시간 없음', tier: 'COMMON' },
  ];

  // 캐릭터 패널
  const duckCell = 7;
  const duckW = DUCK_FRAMES[0][0].length * duckCell;
  const charPanel = `
<path d="${pixelFrame(28, 28, 264, 404, 10)}" fill="${t.well}"/>
<path d="${pixelFrame(28, 28, 264, 404, 10)}" fill="none" stroke="${t.bezelHi}" stroke-width="2"/>
${pixelText('ORI', { x: 28 + (264 - pixelTextWidth('ORI', 5, 1)) / 2, y: 52, cell: 5, fill: t.neon })}
${pixelText('THE DUCK DEV', { x: 28 + (264 - pixelTextWidth('THE DUCK DEV', 2.4, 1)) / 2, y: 94, cell: 2.4, fill: t.muted })}
<g class="idle"><g transform="translate(${28 + (264 - duckW) / 2},128)">${bitmapRects(DUCK_FRAMES[0], { cell: duckCell, colors: DUCK_COLORS })}</g></g>
<rect x="${28 + 42}" y="238" width="${264 - 84}" height="2" fill="${t.bezel}"/>
<text x="${28 + 132}" y="268" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="13" fill="${t.ink}">CLASS: 프론트엔드</text>
<text x="${28 + 132}" y="292" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="13" fill="${t.ink}">GUILD: 웹 어딘가</text>
<text x="${28 + 132}" y="316" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="13" fill="${t.ink}">SPECIALTY: 인터랙션</text>
<text x="${28 + 132}" y="340" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="13" fill="${t.ink}">PASSIVE: 디테일 집착</text>
${pixelText('GOLD: ∞', { x: 28 + (264 - pixelTextWidth('GOLD: ∞', 3, 1)) / 2, y: 372, cell: 3, fill: t.neonAmber })}
`;

  // 아이템 슬롯 (2열 × 4행, 오른쪽 영역)
  const gridX = 318;
  const gridY = 28;
  const slotW = 322;
  const slotH = 92;
  const gap = 12;
  const slots = items.map((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gridX + col * (slotW + gap);
    const y = gridY + row * (slotH + gap);
    const rc = rarity[it.tier];
    const ic = ICONS[it.icon];
    const iconSvg = bitmapRects(ic.grid, { x: x + 18, y: y + 20, cell: 4, colors: ic.map(t) })
      + (ic.post ? ic.post(t, x + 18, y + 20, 4) : '');
    const steam = it.icon === 'coffee'
      ? `<g class="steam"><rect x="${x + 18 + 16}" y="${y + 10}" width="3" height="8" fill="${t.muted}"/><rect x="${x + 18 + 28}" y="${y + 8}" width="3" height="10" fill="${t.muted}"/></g>`
      : '';
    const mythic = it.tier === 'MYTHIC' ? ` class="mythic"` : '';
    return `
<g${mythic}>
<path d="${pixelFrame(x, y, slotW, slotH, 8)}" fill="${t.card === t.well ? t.card : dark ? '#0c1220' : '#faf3e3'}"/>
<path d="${pixelFrame(x, y, slotW, slotH, 8)}" fill="none" stroke="${rc}" stroke-width="2"/>
<rect x="${x + 12}" y="${y + 12}" width="64" height="${slotH - 24}" fill="${t.well}"/>
${iconSvg}${steam}
${pixelText(it.slot, { x: x + 90, y: y + 14, cell: 2, fill: rc })}
<text x="${x + 90}" y="${y + 46}" font-family=${JSON.stringify(KFONT)} font-size="16" font-weight="700" fill="${t.ink}">${esc(it.name)}</text>
<text x="${x + 90}" y="${y + 70}" font-family=${JSON.stringify(KFONT)} font-size="11.5" fill="${t.muted}">${esc(it.kr)}</text>
${pixelText(it.tier, { x: x + slotW - pixelTextWidth(it.tier, 1.8, 1) - 12, y: y + 14, cell: 1.8, fill: rc })}
</g>`;
  }).join('');

  const style = `
${fontFaceCSS({ bold: true })}
.idle{animation:bob 1.6s steps(2,jump-none) infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
.steam rect{animation:steam 2.2s ease-in-out infinite}
.steam rect:last-child{animation-delay:1.1s}
@keyframes steam{0%,100%{opacity:0;transform:translateY(0)}50%{opacity:.9;transform:translateY(-5px)}}
.mythic{animation:myth 2.6s ease-in-out infinite}
@keyframes myth{0%,100%{opacity:1}50%{opacity:.82}}
`;
  const caption = `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="12" fill="${t.faint}">${esc(COPY.inventory.caption)}</text>`;

  return svgDoc({
    w: W, h: H,
    title: 'EQUIPMENT — 장비창',
    desc: '테크 스택을 RPG 장비창으로: React +9, TypeScript 방어구, Claude Code 주문서 등',
    style,
    body: charPanel + slots + caption,
  });
}

// ------------------------------------------------------------
// 5) 푸터 (CONTINUE? 카운트다운 + 코인 투입)
// ------------------------------------------------------------
function footer(t) {
  const H = 190;
  const dark = t.id === 'dark';
  const contW = pixelTextWidth('CONTINUE?', 5, 1);

  // 9→0 카운트다운 (스텝 키프레임으로 숫자 교체)
  const digits = Array.from({ length: 10 }, (_, i) => 9 - i);
  const digitGs = digits.map((d, i) =>
    `<g class="cd cd${i}">${pixelText(String(d), { x: 0, y: 0, cell: 5, fill: t.neonMagenta })}</g>`
  ).join('');
  const cdCSS = digits.map((_, i) => {
    const a = (i * 10).toFixed(0);
    const b = ((i + 1) * 10).toFixed(0);
    return `.cd${i}{animation:cd${i} 10s steps(1,end) infinite}@keyframes cd${i}{0%,100%{opacity:0}${a === '0' ? '' : `${a}%{opacity:1}`}${a === '0' ? '0%{opacity:1}' : ''}${b === '100' ? '99.9%' : b + '%'}{opacity:0}}`;
  }).join('');

  // 코인 투입 애니메이션
  const coinDrop = `
<g class="coindrop">${bitmapRects(COIN_FRAMES[0], { cell: 2, colors: { o: t.neonAmber } })}</g>
<rect x="${-6}" y="46" width="30" height="8" fill="${t.bezelHi}"/>
<rect x="${0}" y="48" width="18" height="4" fill="${t.well}"/>
`;

  const style = `
${fontFaceCSS()}
${cdCSS}
${blinkCSS}
.coindrop{animation:drop 5s ease-in infinite}
@keyframes drop{0%,55%{transform:translateY(-26px);opacity:0}60%{opacity:1;transform:translateY(-26px)}70%,100%{transform:translateY(30px);opacity:0}}
${duckCSS(22)}
`;

  const body = `
<rect x="0" y="0" width="${W}" height="2" fill="${t.bezelHi}"/>
${pixelText('CONTINUE?', { x: (W - contW) / 2 - 30, y: 30, cell: 5, fill: t.ink })}
<g transform="translate(${(W + contW) / 2 + 4},30)">${digitGs}</g>
<g class="blink">${pixelText('INSERT COIN', { x: (W - pixelTextWidth('INSERT COIN', 3, 1)) / 2 - 20, y: 86, cell: 3, fill: t.neonAmber })}</g>
<g transform="translate(${(W + pixelTextWidth('INSERT COIN', 3, 1)) / 2 + 10},64)">${coinDrop}</g>
<text x="${W / 2}" y="132" text-anchor="middle" font-family=${JSON.stringify(KFONT)} font-size="12.5" fill="${t.muted}">${esc(COPY.footer.line)}</text>
${pixelText('(C) 2026 ORI GAMES - MADE WITH ♥ AND COFFEE', { x: (W - pixelTextWidth('(C) 2026 ORI GAMES - MADE WITH ♥ AND COFFEE', 2, 1)) / 2, y: 152, cell: 2, fill: t.faint })}
${walkingDuck(t, 186, { cell: 2, dur: 22, quack: false })}
`;

  return svgDoc({
    w: W, h: H,
    title: 'CONTINUE? — INSERT COIN',
    desc: '아케이드 컨티뉴 화면. 코인을 넣으면 계속됩니다.',
    style, body,
  });
}

// ------------------------------------------------------------
// build all
// ------------------------------------------------------------
mkdirSync(join(root, 'assets'), { recursive: true });

const BANNERS = [
  { key: 'status', num: '01', en: 'STATUS WINDOW', kr: '상태창 — 매일 밤 자동 갱신되는 실제 전투 기록' },
  { key: 'equipment', num: '02', en: 'EQUIPMENT', kr: '장비창 — 지금 손에 들고 있는 것들' },
  { key: 'boss', num: '03', en: 'BOSS RAID', kr: '보스 레이드 — 팩맨이 1년치 잔디를 먹어치우는 중' },
  { key: 'farm', num: '04', en: 'DUCK FARM', kr: '오리 농장 — 커밋으로 키우는 동물들' },
];

for (const [key, t] of Object.entries(THEMES)) {
  console.log(`\n[${key}]`);
  out(`hero-${key}.svg`, hero(t));
  out(`inventory-${key}.svg`, inventory(t));
  out(`footer-${key}.svg`, footer(t));
  for (const b of BANNERS) out(`stage-${b.key}-${key}.svg`, stageBanner(t, b));
  out(`btn-portfolio-${key}.svg`, menuButton(t, { en: 'PORTFOLIO', kr: COPY.menu.portfolio }));
  out(`btn-blog-${key}.svg`, menuButton(t, { en: 'BLOG', kr: COPY.menu.blog }));
  out(`btn-mail-${key}.svg`, menuButton(t, { en: 'CONTACT', kr: COPY.menu.mail }));
}
console.log('\ndone.');
