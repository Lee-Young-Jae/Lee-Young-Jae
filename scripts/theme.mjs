// ============================================================
//  ORI ARCADE — design tokens
//  깃헙 프로필의 모든 SVG가 공유하는 단일 소스.
//  데이터 마크 팔레트는 dataviz validator(6-check) 통과값만 사용.
// ============================================================

export const THEMES = {
  dark: {
    id: 'dark',
    // surfaces
    screen: '#070a12',      // CRT 유리 안쪽
    card: '#0a0f18',        // 카드 표면 (데이터 마크 검증 표면)
    well: '#050810',        // 게이지 홈
    bezel: '#151c2c',       // 베젤 라인
    bezelHi: '#232d44',
    // text
    ink: '#dce6f2',
    muted: '#8b98ad',
    faint: '#4c586e',
    // decorative neons (데이터에 사용 금지)
    neon: '#45f0a2',        // phosphor mint
    neonCyan: '#56c8ff',
    neonMagenta: '#ff6b9d',
    neonAmber: '#ffc24d',
    // data marks — validated (all-pairs worst ΔE 13.0, all checks PASS)
    data: {
      cyan: '#2e9ad8',
      amber: '#c98500',
      magenta: '#e0447e',
      green: '#1e9a58',
      violet: '#9d71f2',
    },
    scanline: 'rgba(0,0,0,0.32)',
    glow: true,
  },
  light: {
    id: 'light',
    // 레트로 게임 종이 매뉴얼 / 캐비닛 아트웍
    screen: '#fdf9f0',
    card: '#fbf5e9',
    well: '#f4eee0',        // 데이터 마크 검증 표면
    bezel: '#d8cfbc',
    bezelHi: '#c3b89f',
    ink: '#20293f',
    muted: '#71695a',
    faint: '#a99f8a',
    neon: '#0f8a58',
    neonCyan: '#1178a5',
    neonMagenta: '#d23f77',
    neonAmber: '#b07400',
    // data marks — validated (light: all checks PASS)
    data: {
      cyan: '#0f7fa8',
      amber: '#a86a00',
      magenta: '#c9366d',
      green: '#0f7d4d',
      violet: '#7d4fc9',
    },
    scanline: 'rgba(32,41,63,0.05)',
    glow: false,
  },
};

// 언어 → 색 (entity-fixed: 순위가 바뀌어도 색은 언어를 따라간다)
export const LANG_HUES = {
  TypeScript: 'cyan',
  JavaScript: 'amber',
  HTML: 'magenta',
  Dart: 'green',
  CSS: 'violet',
  SCSS: 'violet',
  Java: 'amber',
  Python: 'green',
  Shell: 'green',
  Kotlin: 'violet',
  Swift: 'magenta',
};
export const HUE_FALLBACK = ['cyan', 'amber', 'magenta', 'green', 'violet'];

// ============================================================
//  5×7 아케이드 픽셀 폰트 (직접 비트맵 — 폰트 의존성 0)
// ============================================================
export const FONT5 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  2: ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  3: ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
  ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..'],
  '▶': ['#....', '##...', '###..', '####.', '###..', '##...', '#....'],
  '♥': ['.#.#.', '#####', '#####', '.###.', '.###.', '..#..', '.....'],
  '★': ['..#..', '..#..', '#####', '.###.', '.###.', '#...#', '.....'],
  '∞': ['.....', '.....', '.##.#', '#.#.#', '#.##.', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

// ============================================================
//  픽셀 오리 스프라이트 (ori = 오리 🦆) — 2프레임 뒤뚱걸음
//  Y 몸통 / W 배 / O 부리·발 / K 눈
// ============================================================
export const DUCK_FRAMES = [
  [
    '.........YYYY....',
    '........YYYYYY...',
    '........YKYYYY...',
    '........YYYYYYOO.',
    '........YYYYYO...',
    '.Y......YYYYY....',
    '.YY...YYYYYYY....',
    '..YYYYYYYYYYY....',
    '..YYYYYYYWWYY....',
    '...YYYYYWWWY.....',
    '....YYYYYYYY.....',
    '......O...O......',
    '.....OO...OO.....',
  ],
  [
    '.........YYYY....',
    '........YYYYYY...',
    '........YKYYYY...',
    '........YYYYYYOO.',
    '........YYYYYO...',
    '.Y......YYYYY....',
    '.YY...YYYYYYY....',
    '..YYYYYYYYYYY....',
    '..YYYYYYYWWYY....',
    '...YYYYYWWWY.....',
    '....YYYYYYYY.....',
    '.......OO........',
    '......OO.O.......',
  ],
];

export const DUCK_COLORS = {
  Y: '#ffd23f',
  W: '#fff3c4',
  O: '#ff8c42',
  K: '#101319',
};

// ============================================================
//  SVG 헬퍼
// ============================================================

/** 비트맵 문자열 배열 → <rect> 들. cell=픽셀 크기, colors: 문자→색 or 단색 fill */
export function bitmapRects(bitmap, { x = 0, y = 0, cell = 4, fill, colors, className }) {
  const out = [];
  bitmap.forEach((row, ry) => {
    // 가로로 연속된 같은 색 픽셀을 하나의 rect로 병합 (용량 최적화)
    let runStart = -1;
    let runChar = null;
    const flush = (endX) => {
      if (runStart < 0) return;
      const color = colors ? colors[runChar] : fill;
      if (color) {
        out.push(
          `<rect x="${x + runStart * cell}" y="${y + ry * cell}" width="${(endX - runStart) * cell}" height="${cell}" fill="${color}"${className ? ` class="${className}"` : ''}/>`
        );
      }
      runStart = -1;
      runChar = null;
    };
    [...row].forEach((ch, cx) => {
      const solid = ch !== '.' && ch !== ' ';
      if (!solid) return flush(cx);
      if (runStart >= 0 && ch === runChar) return;
      flush(cx);
      runStart = cx;
      runChar = ch;
    });
    flush(row.length);
  });
  return out.join('');
}

/** 5×7 픽셀 폰트 텍스트. letterSpacing은 셀 단위. fillFn(i, ch)로 글자별 색/클래스 지정 가능 */
export function pixelText(str, { x = 0, y = 0, cell = 3, spacing = 1, fill = '#fff', fillFn, classFn }) {
  const parts = [];
  let cx = x;
  [...str.toUpperCase()].forEach((ch, i) => {
    const glyph = FONT5[ch] ?? FONT5['?'];
    const color = fillFn ? fillFn(i, ch) : fill;
    const cls = classFn ? classFn(i, ch) : undefined;
    parts.push(bitmapRects(glyph, { x: cx, y, cell, fill: color, className: cls }));
    cx += (5 + spacing) * cell;
  });
  return parts.join('');
}

/** 픽셀 텍스트 폭 계산 */
export function pixelTextWidth(str, cell = 3, spacing = 1) {
  const n = [...str].length;
  return n * 5 * cell + (n - 1) * spacing * cell;
}

/** CRT 스캔라인 오버레이 */
export function scanlines(t, w, h, opacity = 1) {
  return `
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="2" fill="${t.scanline}"/>
  </pattern>
  <rect width="${w}" height="${h}" fill="url(#scan)" opacity="${opacity}" style="pointer-events:none"/>`;
}

/** 각진 픽셀 프레임(계단 모서리) 패스 — 아케이드 창 테두리 */
export function pixelFrame(x, y, w, h, r = 8) {
  // 계단식 모서리: r 크기의 스텝 2개
  const s = r / 2;
  return [
    `M${x + r},${y}`, `H${x + w - r}`, `v${s}`, `h${s}`, `v${s}`, `h${s}`, // 우상
    `V${y + h - r}`, `h${-s}`, `v${s}`, `h${-s}`, `v${s}`, // 우하
    `H${x + r}`, `v${-s}`, `h${-s}`, `v${-s}`, `h${-s}`, // 좌하
    `V${y + r}`, `h${s}`, `v${-s}`, `h${s}`, `v${-s}`, // 좌상
    'Z',
  ].join('');
}

/** 트윙클 별밭 (결정적 의사난수 — 빌드마다 동일) */
export function starfield(t, w, h, n = 26, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const stars = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(rnd() * (w - 20) + 10);
    const y = Math.round(rnd() * (h * 0.36) + 8);
    const size = rnd() > 0.8 ? 3 : 2;
    const dur = (2.4 + rnd() * 3.2).toFixed(1);
    const delay = (-rnd() * 6).toFixed(1);
    const color = i % 7 === 0 ? t.neonCyan : i % 11 === 0 ? t.neonMagenta : t.ink;
    stars.push(
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" class="tw" style="animation-duration:${dur}s;animation-delay:${delay}s"/>`
    );
  }
  return stars.join('');
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** SVG 문서 래퍼 (role=img + title/desc 접근성 포함) */
export function svgDoc({ w, h, title, desc, body, style }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>${style}
@media (prefers-reduced-motion: reduce){ *{animation:none !important} }
</style>
${body}
</svg>`;
}
