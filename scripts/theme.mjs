// ============================================================
//  ORI TERMINAL — 디자인 토큰 + 세션 연출 엔진
//  모든 SVG가 공유하는 단일 소스. 데이터 마크 색은 validator 통과값만.
// ============================================================

export const THEMES = {
  dark: {
    id: 'dark',
    // ORI NIGHT
    bg: '#0d1420',        // 터미널 내부
    chrome: '#131c2b',    // 타이틀바/tmux바
    border: '#273349',
    well: '#0a0e17',      // 게이지 홈/히트맵 빈 칸 (검증 표면)
    fg: '#d7e2f0',
    dim: '#64748e',
    faint: '#3d4a61',
    // ANSI 계열 (장식/신택스 전용)
    green: '#63e6a4',
    cyan: '#67c7ff',
    magenta: '#ff7fb2',
    amber: '#ffcf6e',
    red: '#ff7676',
    // 데이터 마크 — 검증 통과 (all-pairs worst ΔE 13.0, PASS)
    data: { cyan: '#2e9ad8', amber: '#c98500', magenta: '#e0447e', green: '#1e9a58', violet: '#9d71f2' },
    // 히트맵 순차 램프 — ordinal PASS (light-end 2.36:1)
    ramp: ['#1d5a34', '#25804a', '#31a862', '#56d089', '#a0f2c3'],
    shadow: 0.5,
    selection: 'rgba(103,199,255,0.14)',
  },
  light: {
    id: 'light',
    // ORI PAPER
    bg: '#fbf7ee',
    chrome: '#f0e9da',
    border: '#d9d0bc',
    well: '#f1ece0',
    fg: '#26304a',
    dim: '#877e6b',
    faint: '#b3a892',
    green: '#0d8a55',
    cyan: '#0e7fae',
    magenta: '#c9366d',
    amber: '#a86a00',
    red: '#c04343',
    data: { cyan: '#0f7fa8', amber: '#a86a00', magenta: '#c9366d', green: '#0f7d4d', violet: '#7d4fc9' },
    ramp: ['#6fb28c', '#4da175', '#2a8a58', '#11744a', '#0a4d31'],
    shadow: 0.14,
    selection: 'rgba(14,127,174,0.12)',
  },
};

// 언어 → 데이터 색 (entity-fixed)
export const LANG_HUES = {
  TypeScript: 'cyan', JavaScript: 'amber', HTML: 'magenta', Dart: 'green',
  CSS: 'violet', SCSS: 'violet', Java: 'amber', Python: 'green', Shell: 'green',
};
export const HUE_FALLBACK = ['cyan', 'amber', 'magenta', 'green', 'violet'];

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ------------------------------------------------------------
//  모노스페이스 그리드 (D2Coding: 한글 2셀, 그 외 1셀 — hmtx 검증값)
// ------------------------------------------------------------
export const isWide = (ch) => ch.charCodeAt(0) > 0x2e7f; // 한글/한자 블록
export const cells = (str) => [...str].reduce((a, c) => a + (isWide(c) ? 2 : 1), 0);

// ------------------------------------------------------------
//  SVG 조각
// ------------------------------------------------------------

/** 색 세그먼트를 tspan으로. segs: [text, colorKeyOrHex|null(=fg), bold?][] */
export function line(t, x, y, segs, { fs = 14, cls } = {}) {
  const spans = segs.map(([text, color, bold]) => {
    const fill = color ? (t[color] ?? color) : t.fg;
    return `<tspan fill="${fill}"${bold ? ' font-weight="700"' : ''}>${esc(text)}</tspan>`;
  }).join('');
  return `<text${cls ? ` class="${cls}"` : ''} x="${x}" y="${y}" font-size="${fs}" xml:space="preserve">${spans}</text>`;
}

/** macOS 윈도우 크롬 + tmux 상태바. body는 내부에 그린다. */
export function windowChrome(t, { w, h, title, activeWin = 0, windows, host, clock }) {
  const P = 12; // 그림자 여백
  const bw = w - P * 2;
  const bh = h - P * 2;
  const bar = 30; // 타이틀바
  const tmuxH = windows.length ? 26 : 0;
  const winTabs = windows.map((name, i) => {
    const active = i === activeWin;
    return [`  ${name}${active ? '*' : ' '}`, active ? 'green' : 'dim', active];
  });
  const tmuxBar = windows.length ? `
<rect x="${P}" y="${P + bh - tmuxH}" width="${bw}" height="${tmuxH}" fill="${t.chrome}"/>
${line(t, P + 14, P + bh - tmuxH / 2 + 4.5, [['[ori]', 'green', true], ...winTabs], { fs: 12 })}
<text x="${P + bw - 14}" y="${P + bh - tmuxH / 2 + 4.5}" text-anchor="end" font-size="12" fill="${t.dim}">${esc(host)}${clock ? `  ·  ${esc(clock)}` : ''}</text>` : '';
  return {
    P, bar,
    bodyY: P + bar,
    bodyH: bh - bar - tmuxH,
    tmuxY: P + bh - tmuxH,
    open: `
<defs>
  <filter id="winShadow" x="-6%" y="-6%" width="112%" height="116%">
    <feDropShadow dx="0" dy="5" stdDeviation="9" flood-color="#000" flood-opacity="${t.shadow}"/>
  </filter>
  <clipPath id="winClip"><rect x="${P}" y="${P}" width="${bw}" height="${bh}" rx="10"/></clipPath>
</defs>
<g filter="url(#winShadow)"><rect x="${P}" y="${P}" width="${bw}" height="${bh}" rx="10" fill="${t.bg}"/></g>
<g clip-path="url(#winClip)">
<rect x="${P}" y="${P}" width="${bw}" height="${bar}" fill="${t.chrome}"/>
<circle cx="${P + 22}" cy="${P + bar / 2}" r="6" fill="#ff5f57"/>
<circle cx="${P + 42}" cy="${P + bar / 2}" r="6" fill="#febc2e"/>
<circle cx="${P + 62}" cy="${P + bar / 2}" r="6" fill="#28c840"/>
<text x="${w / 2}" y="${P + bar / 2 + 4.5}" text-anchor="middle" font-size="12" fill="${t.dim}">${esc(title)}</text>
${tmuxBar}
`,
    close: `</g>
<rect x="${P}" y="${P}" width="${bw}" height="${bh}" rx="10" fill="none" stroke="${t.border}" stroke-width="1.5"/>`,
  };
}

// ------------------------------------------------------------
//  세션 연출 엔진 — 타이핑/출력 타임라인을 CSS로 컴파일
// ------------------------------------------------------------
export function makeSession(t, { x, y, fs = 14, lh = 22, cps = 22 }) {
  const CW = fs / 2;
  const lines = [];
  let cursorY = y;
  let clock = 0; // 초
  let seq = 0;

  const promptSegs = (cmd) => [['❯ ', 'green', true], [cmd, null]];

  return {
    /** 명령 타이핑 (커서 블록이 글자를 따라간다) */
    type(cmd, { pause = 0.5 } = {}) {
      const id = `ty${seq++}`;
      const n = cells(cmd);
      const dur = Math.max(n / cps, 0.35);
      const start = clock + pause;
      // 문자 경계 스텝 키프레임 (모노 그리드라 셀 단위)
      const widths = [];
      let acc = 0;
      widths.push(0);
      for (const ch of cmd) { acc += (isWide(ch) ? 2 : 1); widths.push(acc); }
      const steps = widths.length - 1;
      const kf = widths.map((wc, i) =>
        `${((i / steps) * 100).toFixed(2)}%{width:${(wc * CW).toFixed(1)}px}`).join('');
      const ckf = widths.map((wc, i) =>
        `${((i / steps) * 100).toFixed(2)}%{transform:translateX(${(wc * CW).toFixed(1)}px)}`).join('');
      const promptW = 2 * CW; // "❯ "
      lines.push({
        svg: `
<clipPath id="${id}c"><rect class="${id}b" x="${x + promptW}" y="${cursorY - fs}" width="0" height="${lh}"/></clipPath>
<g class="reveal ${id}r">
${line(t, x, cursorY, [['❯ ', 'green', true]])}
<g clip-path="url(#${id}c)">${line(t, x + promptW, cursorY, [[cmd, null]])}</g>
<g class="${id}k" opacity="0"><rect class="cur" x="${x + promptW}" y="${cursorY - fs + 1}" width="${CW}" height="${fs + 3}" fill="${t.green}"/></g>
</g>`,
        css: `
.${id}r{animation:show .01s linear ${start.toFixed(2)}s both}
.${id}b{animation:${id}w ${dur.toFixed(2)}s steps(1,end) ${start.toFixed(2)}s both}
@keyframes ${id}w{${kf}}
.${id}k{animation:curon2 .01s linear ${start.toFixed(2)}s forwards, curoff .01s linear ${(start + dur + 0.1).toFixed(2)}s forwards}
.${id}k .cur{animation:${id}m ${dur.toFixed(2)}s steps(1,end) ${start.toFixed(2)}s both}
@keyframes ${id}m{${ckf}}`,
      });
      clock = start + dur;
      cursorY += lh;
      return this;
    },

    /** 출력 라인(들) — 타이핑 없이 순차 등장 */
    out(segsList, { stagger = 0.06, pause = 0.15, fs: ofs = fs, lh: olh = lh } = {}) {
      const start = clock + pause;
      segsList.forEach((segs, i) => {
        const id = `o${seq++}`;
        lines.push({
          svg: `<g class="reveal ${id}">${typeof segs === 'string' ? segs : line(t, x, cursorY, segs, { fs: ofs })}</g>`,
          css: `.${id}{animation:show .01s linear ${(start + i * stagger).toFixed(2)}s both}`,
        });
        cursorY += olh;
      });
      clock = start + (segsList.length - 1) * stagger;
      return this;
    },

    /** 임의 SVG 블록 등장 (히트맵 등) — height만큼 커서 이동 */
    block(svgFn, height, { pause = 0.2 } = {}) {
      const start = clock + pause;
      const id = `b${seq++}`;
      lines.push({
        svg: `<g class="reveal ${id}">${svgFn(x, cursorY)}</g>`,
        css: `.${id}{animation:show .01s linear ${start.toFixed(2)}s both}`,
      });
      clock = start;
      cursorY += height;
      return this;
    },

    gap(n = 1) { cursorY += lh * n; return this; },

    /** 마지막 유휴 프롬프트 + 영원히 깜빡이는 커서 */
    idle() {
      const start = clock + 0.4;
      const id = `idle${seq++}`;
      lines.push({
        svg: `
<g class="reveal ${id}">${line(t, x, cursorY, [['❯ ', 'green', true]])}
<rect x="${x + 2 * CW}" y="${cursorY - fs + 1}" width="${CW}" height="${fs + 3}" fill="${t.green}" class="idleblink"/></g>`,
        css: `.${id}{animation:show .01s linear ${start.toFixed(2)}s both}
.idleblink{animation:blink 1.1s steps(2,jump-none) ${start.toFixed(2)}s infinite}`,
      });
      clock = start;
      cursorY += lh;
      return this;
    },

    get y() { return cursorY; },
    get t() { return clock; },

    render() {
      return {
        svg: lines.map((l) => l.svg).join('\n'),
        css: `
@keyframes show{from{opacity:0}to{opacity:1}}
@keyframes curon2{to{opacity:1}}
@keyframes curoff{to{opacity:0}}
@keyframes blink{0%{opacity:1}50%{opacity:0}100%{opacity:1}}
.reveal{opacity:0;animation-fill-mode:both}
` + lines.map((l) => l.css).join('\n'),
        endY: cursorY,
        endT: clock,
      };
    },
  };
}

/** SVG 문서 래퍼 (접근성 + reduced-motion 대응) */
export function svgDoc({ w, h, title, desc, body, style, font }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>
${font}
text{font-family:'D2Coding',ui-monospace,'Apple SD Gothic Neo',monospace;white-space:pre}
${style}
@media (prefers-reduced-motion: reduce){ *{animation:none !important} .reveal{opacity:1} .cur{opacity:0 !important} }
</style>
${body}
</svg>`;
}
