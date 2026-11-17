// ============================================================
//  ORI TERMINAL — 단일 세션 녹화본 렌더러
//  GitHub GraphQL → assets/session-{dark,light}.svg 하나에
//  ori-fetch / about / stats(오리가 잔디를 헤엄침) / repos /
//  quack --max 피날레(픽셀 QUACK! + EQ + 색종이 + 군무)까지 전부.
//  usage: GITHUB_TOKEN=... node scripts/render-stats.mjs
// ============================================================
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  THEMES, LANG_HUES, HUE_FALLBACK, line, windowChrome, makeSession, svgDoc, cells, esc,
} from './theme.mjs';
import { fontFaceCSS, assertCovered, sanitizeCovered } from './fonts.mjs';
import { COPY } from './copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = 'Lee-Young-Jae';

// HUD_TOKEN(PAT) > GITHUB_TOKEN(Actions 기본)
const TOKEN = process.env.HUD_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN이 필요합니다. (로컬: GITHUB_TOKEN=$(gh auth token) node scripts/render-stats.mjs)');
  process.exit(1);
}

// ------------------------------------------------------------
// 데이터
// ------------------------------------------------------------
async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error('GraphQL errors: ' + JSON.stringify(json.errors));
  return json.data;
}

async function fetchStats() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const year = kst.getUTCFullYear();
  const q = `
query($login: String!, $thisFrom: DateTime!, $lastFrom: DateTime!, $lastTo: DateTime!, $rollFrom: DateTime!) {
  user(login: $login) {
    thisYear: contributionsCollection(from: $thisFrom) { contributionCalendar { totalContributions } }
    lastYear: contributionsCollection(from: $lastFrom, to: $lastTo) { contributionCalendar { totalContributions } }
    rolling: contributionsCollection(from: $rollFrom) {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes { stargazerCount languages(first: 6, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } } }
    }
    recent: repositories(first: 20, ownerAffiliations: [OWNER, ORGANIZATION_MEMBER], isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes {
        name description pushedAt isArchived isPrivate
        owner { login }
        primaryLanguage { name }
        defaultBranchRef { target { ... on Commit { abbreviatedOid } } }
      }
    }
  }
}`;
  const d = await gql(q, {
    login: LOGIN,
    thisFrom: `${year}-01-01T00:00:00Z`,
    lastFrom: `${year - 1}-01-01T00:00:00Z`,
    lastTo: `${year - 1}-12-31T23:59:59Z`,
    rollFrom: new Date(now.getTime() - 364 * 86400 * 1000).toISOString(),
  });
  const u = d.user;

  const weeks = u.rolling.contributionCalendar.weeks;
  const days = weeks.flatMap((w) => w.contributionDays).sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = kst.toISOString().slice(0, 10);

  let longest = 0; let run = 0;
  for (const day of days) {
    if (day.date > todayStr) continue;
    run = day.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const past = days.filter((day) => day.date <= todayStr);
  let idx = past.length - 1;
  let current = 0;
  if (idx >= 0 && past[idx].contributionCount === 0) idx--;
  for (; idx >= 0 && past[idx].contributionCount > 0; idx--) current++;

  // HTML은 생성 산출물(리포트·정적 페이지) 비중이 커서 실제 작업 언어를 가린다 — 제외
  const LANG_EXCLUDE = new Set(['HTML', 'PLpgSQL', 'Roff', 'Makefile', 'Dockerfile', 'Batchfile', 'CMake', 'Jupyter Notebook']);
  const langBytes = new Map();
  for (const repo of u.repositories.nodes) {
    for (const e of repo.languages.edges) {
      if (LANG_EXCLUDE.has(e.node.name)) continue;
      langBytes.set(e.node.name, (langBytes.get(e.node.name) ?? 0) + e.size);
    }
  }
  const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1;
  const langs = [...langBytes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, bytes]) => ({ name, pct: (bytes / totalBytes) * 100 }));

  const hide = new Set(COPY.repos.hide);
  let privLeft = COPY.repos.maxPrivate ?? Infinity; // 모자이크 줄이 목록을 덮지 않게
  const recent = u.recent.nodes
    .filter((r) => !r.isArchived && !hide.has(r.name) && r.name !== LOGIN
      && r.defaultBranchRef?.target?.abbreviatedOid)
    .filter((r) => !r.isPrivate || privLeft-- > 0)
    .slice(0, COPY.repos.max)
    .map((r) => ({
      name: r.name,
      private: r.isPrivate,
      org: r.owner.login !== LOGIN,
      desc: r.isPrivate ? '' : sanitizeCovered(r.description ?? ''),
      oid: r.defaultBranchRef.target.abbreviatedOid,
      lang: r.primaryLanguage?.name ?? '',
      pushedAt: r.pushedAt,
    }));

  return {
    year, todayStr, weeks,
    thisYearTotal: u.thisYear.contributionCalendar.totalContributions,
    lastYearTotal: u.lastYear.contributionCalendar.totalContributions,
    streak: current, longestStreak: longest,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    followers: u.followers.totalCount,
    langs, recent,
  };
}

// ------------------------------------------------------------
// 공통 상수/헬퍼
// ------------------------------------------------------------
const fmt = (n) => n.toLocaleString('en-US');
const W = 1000;
const FS = 14;
const LH = 22;
const CW = FS / 2;
const SPEED = 1.7; // 세션 전체 배속 (타이핑·출력 간격)

function relAgo(pushedAt, now) {
  const days = Math.max(0, Math.floor((now - new Date(pushedAt).getTime()) / 86400000));
  if (days === 0) return COPY.repos.ago.today;
  if (days < 7) return COPY.repos.ago.days(days);
  if (days < 35) return COPY.repos.ago.weeks(Math.round(days / 7));
  return COPY.repos.ago.months(Math.max(1, Math.round(days / 30)));
}

const mono = (t, tx, ty, str, fill, cls, extra = '') =>
  `<text${cls ? ` class="${cls}"` : ''} x="${tx}" y="${ty}" font-size="14" xml:space="preserve" fill="${fill}"${extra}>${esc(str)}</text>`;

// ---- 모자이크: 깨진 유니코드 글리치 (시드 기반 결정적 — 빌드마다 동일) ----
// 블록·아스키 노이즈·박스 파편을 섞은 프레임들이 버스트→멈춤 리듬으로 지직거리고,
// 가끔 마젠타로 색이 깨지며 ±1px 지터가 흔들림을 더한다. (전 글자 반폭 — 그리드 유지)
const maskLen = (name) => Math.min(Math.max(name.length, 3), 28);
const MOS_SLOTS = [0.1, 0.1, 0.22, 0.1, 0.1, 0.38]; // 프레임별 노출 시간(초) — 불규칙 버스트
const MOS_T = MOS_SLOTS.reduce((a, b) => a + b, 0);
const MOS_CHARS = [
  ['▓', '▒', '█', '░'],
  ['#', '%', '&', '@', '$', '?', '~', '*', '+', '='],
  ['┼', '─', '│', '├', '┤', '┬', '┴', '✗', '×'],
];
function mosaic(t, x, y, seed, len, phase, color) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pick = () => {
    const v = rnd();
    const set = MOS_CHARS[v < 0.5 ? 0 : v < 0.78 ? 1 : 2];
    return set[Math.floor(rnd() * set.length)];
  };
  return MOS_SLOTS.map((_, k) => {
    let f = '';
    for (let i = 0; i < len; i++) f += pick();
    const jx = k === 0 ? 0 : Math.floor(rnd() * 3) - 1;      // ±1px 지터 (frame0은 고정 — reduced-motion 대비)
    const col = k !== 0 && rnd() < 0.18 ? 'magenta' : color; // 가끔 색 깨짐
    return `<g class="mosf mosf${k}" style="animation-delay:${(-(phase * 0.23) % MOS_T).toFixed(2)}s" transform="translate(${jx},0)">${line(t, x, y, [[f, col]])}</g>`;
  }).join('');
}
const MOSAIC_CSS = (() => {
  const rules = ['.mosf{opacity:0}'];
  let acc = 0;
  MOS_SLOTS.forEach((d, k) => {
    const s = (acc / MOS_T) * 100; acc += d;
    const e = (acc / MOS_T) * 100;
    const kf = (s > 0 ? [`0%{opacity:0}`, `${s.toFixed(1)}%{opacity:1}`] : ['0%{opacity:1}'])
      .concat(e < 100 ? [`${e.toFixed(1)}%{opacity:0}`, '100%{opacity:0}'] : ['100%{opacity:1}']);
    rules.push(`.mosf${k}{${k === 0 ? 'opacity:1;' : ''}animation:mosf${k} ${MOS_T}s steps(1,end) infinite}`);
    rules.push(`@keyframes mosf${k}{${kf.join('')}}`);
  });
  return '\n' + rules.join('\n');
})();

function bar(t, x, y, w, h, ratio, color, sheen) {
  const fw = Math.max(w * Math.min(ratio, 1), 3);
  const base = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${t.well}"/>
<rect class="grow" x="${x}" y="${y}" width="${fw.toFixed(1)}" height="${h}" rx="2" fill="${color}" style="transform-origin:${x}px 0"/>`;
  if (!sheen || fw < 24) return base;
  // 채워진 구간만 클립 → 비스듬한 빛줄기가 주기적으로 훑는다
  return base + `<clipPath id="${sheen.id}"><rect x="${x}" y="${y}" width="${fw.toFixed(1)}" height="${h}" rx="2"/></clipPath>
<g clip-path="url(#${sheen.id})"><polygon class="sheen" style="--w:${(fw + 60).toFixed(0)}px;animation-delay:${sheen.delay.toFixed(2)}s" points="${x - 40},${y + h} ${x - 28},${y} ${x - 12},${y} ${x - 24},${y + h}" fill="#fff" opacity=".3"/></g>`;
}

// ---- 오도미터: 숫자가 자리마다 굴러 올라와 멈춘다 (정지 상태 = 최종값 → reduced-motion 안전) ----
function odometer(t, x, y, str, start, { id = 'odoc', fill = t.fg, bold = true } = {}) {
  let out = `<clipPath id="${id}"><rect x="${x - 1}" y="${y - FS}" width="${str.length * CW + 2}" height="${LH - 2}"/></clipPath><g clip-path="url(#${id})"${bold ? ' font-weight="700"' : ''}>`;
  [...str].forEach((ch, i) => {
    const cx = x + i * CW;
    if (!/\d/.test(ch)) { out += mono(t, cx, y, ch, fill); return; }
    const n = 10 + Number(ch); // 한 바퀴 돌고 제 숫자에 정착
    let strip = '';
    for (let k = 0; k <= n; k++) strip += mono(t, cx, y + k * LH, String(k % 10), fill);
    out += `<g class="odo" style="transform:translateY(${-n * LH}px);animation-delay:${(start + i * 0.1).toFixed(2)}s">${strip}</g>`;
  });
  return out + '</g>';
}

// ---- REC 타임코드: 페이지를 연 뒤 흐른 시간(mm:ss)을 CSS steps만으로 센다 ----
function timecode(t, x, y) {
  const dy = 16; const cw = 6;
  const digit = (i, n, dur) => {
    let strip = '';
    for (let k = 0; k < n; k++) strip += `<text x="${x + i * cw}" y="${y + k * dy}" font-size="12" fill="${t.dim}">${k}</text>`;
    return `<g class="tc" style="animation:tc${n} ${dur}s steps(${n}) infinite">${strip}</g>`;
  };
  return `<clipPath id="tcc"><rect x="${x - 1}" y="${y - 11}" width="${5 * cw + 2}" height="14"/></clipPath><g clip-path="url(#tcc)">`
    + digit(0, 6, 3600) + digit(1, 10, 600)
    + `<text x="${x + 2 * cw}" y="${y}" font-size="12" fill="${t.dim}">:</text>`
    + digit(3, 6, 60) + digit(4, 10, 10) + '</g>';
}
const TIMECODE_CSS = `
@keyframes tc10{to{transform:translateY(-160px)}}
@keyframes tc6{to{transform:translateY(-96px)}}`;

// ---- 타임라인 컴파일러: 가시 구간 목록 → steps 키프레임 ----
function visKF(name, windows, P) {
  const evs = windows.flatMap(([s, e]) => [[s, 1], [e, 0]]).sort((a, b) => a[0] - b[0]);
  const segs = [];
  let prev = 0; let state = 0;
  for (const [tt, v] of evs) {
    if (tt > prev) segs.push([prev, tt, state]);
    prev = tt; state = v;
  }
  segs.push([prev, P, state]);
  const pct = (x) => ((x / P) * 100).toFixed(2);
  const body = segs.filter(([s, e]) => e - s > 0.001)
    .map(([s, e, v]) => `${pct(s)}%,${pct(e - 0.005)}%{opacity:${v}}`).join('');
  return `@keyframes ${name}{${body}100%{opacity:${segs[segs.length - 1][2]}}}`;
}
function complementWindows(others, P) {
  const evs = others.flat().flatMap(([s, e]) => [[s, 1], [e, -1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let depth = 0; let openAt = 0;
  for (const [tt, d] of evs) {
    if (depth === 0 && tt > openAt) out.push([openAt, tt]);
    depth += d;
    if (depth === 0) openAt = tt;
  }
  if (openAt < P) out.push([openAt, P]);
  return out;
}

// ---- 색 유틸: 입체 기둥 측면 음영 ----
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(v * f).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

// 픽셀 배너용 5×7 비트맵 (피날레 전용)
const PXF = {
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
};
function pixelBanner(word, x, y, cell, fill, start) {
  let ps = 7;
  const pr = () => ((ps = (ps * 16807) % 2147483647) / 2147483647);
  // 글자별 그룹 — 무지개 웨이브 + 개별 바운스 (delay 스태거)
  let out = '';
  let cx = x;
  [...word].forEach((ch, li) => {
    const g = PXF[ch];
    let letter = '';
    g.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        // 흩어진 자리(--dx,--dy)에서 날아와 제자리에 꽂힌다 (정지 상태 = 완성형)
        if (c === '#') letter += `<rect class="px" style="--dx:${Math.round((pr() - 0.5) * 520)}px;--dy:${Math.round((pr() - 0.5) * 240)}px;animation-delay:${(start + pr() * 0.45).toFixed(2)}s" x="${cx + rx * cell}" y="${y + ry * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`;
      });
    });
    out += `<g class="bl" style="transform-box:fill-box;transform-origin:50% 100%;animation-delay:${(-li * 0.5).toFixed(2)}s,${(-li * 0.13).toFixed(2)}s">${letter}</g>`;
    cx += 6 * cell;
  });
  return `<g>${out}</g>`;
}

// ------------------------------------------------------------
// 세션 조립
// ------------------------------------------------------------
function sessionSvg(t, s) {
  const P = 12;
  const bodyX = P + 30;
  const bodyY = P + 30 + 34;
  const dark = t.id === 'dark';
  const sess = makeSession(t, { x: bodyX, y: bodyY, fs: FS, lh: LH, speed: SPEED });
  const extraCSS = [];
  // ── 마스터 주기: 오리 한 마리가 연못 → 섬 앞바다 → QUACK 무대를 돌고 돌아오는 여정 + 섬 1년 타임랩스 ──
  const M = 40;                          // 초
  const pcM = (sec) => ((sec / M) * 100).toFixed(2);
  const T_DIVE = 13.4;                   // 연못에서 마지막 자맥질 시작
  const T_SINK = 14.6;                   // 완전히 잠수 (연못을 떠남)
  const T_FALL = 14.9;                   // 화면 아래로 낙하 시작
  const T_SPLASH = 16.0;                 // 섬 앞바다 착수
  const T_BACK = 30.3;                   // 연못으로 복귀(솟아오름)
  let pondPt = null; let partySlot = null; let monthStarts = [];
  const now = Date.now();

  // ============ 1) ori-fetch (로고 오리: DP초 서사 타임라인) ============
  // 물에 앉아 까딱 → 깜빡 → 꽥 → 자맥질(몸을 기울여 머리가 물속으로, 발장구·기포·파문)
  // → 솟구치며 물 털기 → 날갯짓×2 → 깜빡. 수면 반영은 필터로 일렁이고 물고기가 지나간다.
  sess.type(COPY.fetch.cmd, { pause: 0.6 });

  const DP = M;
  const D_A = ['        __', '      <(o )____', '       (  ._> /', "        `----'"];
  const D_B = ['        __', '      <(- )____', '       (  ._> /', "        `----'"];
  const D_C = ['        __', '      <(o )____', '       (  .^> /', "        `----'"];
  const D_D = ['        __', '      <(O )____', '       (  ._> /', "        `----'"];
  const W_B = [[2.5, 2.72], [9, 9.22], [33.5, 33.72], [38.5, 38.72]];          // 깜빡
  const W_D = [[4.2, 5.0], [11.4, 12.2], [36, 36.8]];                             // 꽥 (눈 크게)
  const W_C = [[6.5, 6.8], [7.1, 7.4], [31.3, 31.6], [31.9, 32.2]];               // 날갯짓
  const W_A = complementWindows([W_B, W_D, W_C], DP);
  const W_E = []; const W_F = [];                                                 // 발장구 (자맥질 동안 번갈아)
  for (let i = 0; i < 4; i++) (i % 2 ? W_F : W_E).push([T_DIVE + 0.4 + i * 0.2, T_DIVE + 0.4 + (i + 1) * 0.2]);

  const infoX = bodyX + 250;
  const fetchStart = sess.t + 0.25 / SPEED;
  sess.block((x, y) => {
    const artX = x + 8;
    const rowY = (i) => y + i * LH;
    const wl = rowY(3) - 2;                                   // 수면선 — 배 밑줄이 물에 닿는 높이
    const pv = [artX + 10.5 * CW, rowY(2) - 2];               // 자맥질 회전축 (몸통 중심)
    pondPt = [pv[0] - 26, wl + 14 + LH * 0.9];                // 잠수한 오리가 화면 아래로 빠져나오는 자리
    const art = (rows, cls) => `<g class="${cls}">${rows.map((ln, i) =>
      mono(t, artX, rowY(i), ln, t.amber)).join('')}</g>`;
    const body = `<g class="dbob"><g class="dtip" style="transform-origin:${pv[0]}px ${pv[1]}px">${art(D_A, 'fA') + art(D_B, 'fB') + art(D_C, 'fC') + art(D_D, 'fD')}</g></g>`;
    // 구름 (뒤편, 드리프트)
    const clouds = `<g class="cl1">${mono(t, artX + 118, rowY(0) - 8, '.-~~-.', t.faint)}</g>
<g class="cl2">${mono(t, artX + 152, rowY(1) - 2, '.-~.', t.faint)}</g>`;
    // 수면: 사인 물결 2겹 — 오리 위에 그려 배 밑줄을 적신다
    const wvW = 17 * CW + 8;
    const wavePath = (x0, y0, amp, p, n) =>
      `M${x0},${y0} q${p / 4},${amp} ${p / 2},0` + ` t${p / 2},0`.repeat(n);
    const waves = `<clipPath id="wvc"><rect x="${artX - 2}" y="${wl - 10}" width="${wvW}" height="22"/></clipPath>
<g clip-path="url(#wvc)">
<g class="wvp1"><path d="${wavePath(artX - 26, wl, 3.2, 24, Math.ceil(wvW / 12) + 4)}" fill="none" stroke="${t.cyan}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/></g>
<g class="wvp2"><path d="${wavePath(artX - 38, wl + 6, 2.4, 30, Math.ceil(wvW / 15) + 4)}" fill="none" stroke="${t.cyan}" stroke-width="1.4" stroke-linecap="round" opacity="0.32"/></g>
</g>`;
    // 물 위 오리는 수면선에서 잘리고, 물 아래는 뒤집힌 반영이 필터로 일렁인다 (같은 클래스 공유 → 동작 동기화)
    const above = `<clipPath id="dkc"><rect x="${artX - 30}" y="${y - 60}" width="${wvW + 60}" height="${wl + 60 - y}"/></clipPath><g clip-path="url(#dkc)">${body}</g>`;
    const reflection = `<filter id="rip" x="-15%" y="-30%" width="130%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.14" numOctaves="1" seed="5"><animate attributeName="baseFrequency" dur="6s" values="0.02 0.14;0.035 0.24;0.02 0.14" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
<linearGradient id="rfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="rfm" maskUnits="userSpaceOnUse" x="${artX - 30}" y="${wl + 4}" width="${wvW + 60}" height="46"><rect x="${artX - 30}" y="${wl + 4}" width="${wvW + 60}" height="46" fill="url(#rfg)"/></mask>
<g mask="url(#rfm)" opacity="${dark ? 0.3 : 0.22}"><g filter="url(#rip)"><g transform="translate(0,${2 * wl + 6}) scale(1,-1)">${body}</g></g></g>`;
    // 발장구 (자맥질 동안 꼬리 위에서 번갈아)
    const feet = `<g class="fE">${mono(t, pv[0] - 30, pv[1] - 30, '\\/', t.amber)}</g><g class="fF">${mono(t, pv[0] - 30, pv[1] - 30, '/\\', t.amber)}</g>`;
    // 파문 (들어갈 때·나올 때 수면에서 퍼지는 타원)
    const ring = (cls) => `<ellipse class="rp ${cls}" cx="${pv[0] - 12}" cy="${wl}" rx="46" ry="6" fill="none" stroke="${t.cyan}" stroke-width="1.3"/>`;
    const rings = ring('rpA') + ring('rpB') + ring('rpC') + ring('rpD');
    // 자맥질 기포 (물속 머리 자리에서 뽀글뽀글)
    const dabbleBubbles = [[-6, 0, 'o'], [6, -6, '.'], [-14, -10, '.']].map(([dx, dy, ch], i) =>
      `<g class="dbub dbub${i}">${mono(t, pv[0] - 22 + dx, wl - 4 + dy, ch, t.cyan)}</g>`).join('');
    // 물 털기 물방울 (수면에서 양옆으로 튀어 오름)
    const splash = [[-56, '.'], [-44, "'"], [-34, '*'], [34, "'"], [46, '.']].map(([dx, ch], i) =>
      `<g class="spl" style="--sx:${(i < 3 ? -1 : 1) * (4 + i * 2)}px">${mono(t, pv[0] - 8 + dx, wl - 6, ch, t.cyan)}</g>`).join('');
    // 물속을 지나가는 물고기
    const fish = `<clipPath id="fsc"><rect x="${artX - 2}" y="${wl + 6}" width="${wvW}" height="30"/></clipPath><g clip-path="url(#fsc)"><g class="fish">${mono(t, artX - 24, wl + 24, '><>', t.cyan)}</g></g>`;
    // 꽥 말풍선 (부리 앞)
    const bubble = `<g class="fqk">${mono(t, artX + 1.5 * CW, rowY(0) + 8, COPY.party.quack + '!', t.magenta)}</g>`;

    // 정보 행: 암호가 풀리듯 한 줄씩 해독되어 나타난다
    let sd = 4242;
    const sr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const NOISE = '#%&@$?~*+=<>/\\|';
    const rows = COPY.fetch.rows.map(([k, v], i) => {
      const padded = k + ' '.repeat(Math.max(10 - cells(k), 1));
      const vx = infoX + cells(padded) * CW;
      const d0 = fetchStart + 0.1 + i * 0.09;
      const n = cells(assertCovered(v, 'fetch'));
      const scr = [0, 1, 2].map((f) => {
        let str = '';
        for (let c = 0; c < n; c++) str += NOISE[Math.floor(sr() * NOISE.length)];
        return `<g class="scr" style="animation-delay:${(d0 + f * 0.09).toFixed(2)}s">${mono(t, vx, y + i * LH, str, f === 2 ? t.green : t.dim)}</g>`;
      }).join('');
      return `<g class="reveal" style="animation:show .01s linear ${d0.toFixed(2)}s both">${line(t, infoX, y + i * LH, [[padded, 'green', true]])}</g>${scr}`
        + `<g class="reveal" style="animation:show .01s linear ${(d0 + 0.27).toFixed(2)}s both">${line(t, vx, y + i * LH, [[v, null]])}</g>`;
    }).join('');
    const swY = y + COPY.fetch.rows.length * LH - 8;
    const sw = ['green', 'cyan', 'magenta', 'amber', 'red', 'dim', 'fg', 'faint'].map((c, i) =>
      `<rect class="swt" style="animation-delay:${(i * 0.11).toFixed(2)}s" x="${infoX + i * 26}" y="${swY}" width="20" height="10" rx="2" fill="${t[c]}"/>`).join('');
    const title = line(t, infoX, y - LH, [['ori', 'cyan', true], [' @ ', 'dim'], [COPY.host, 'cyan', true]]);
    const rule = `<rect x="${infoX}" y="${y - LH + 8}" width="${cells('ori @ ' + COPY.host) * CW}" height="1.5" fill="${t.border}"/>`;
    return `${title}${rule}<g transform="translate(0,${LH * 0.9})">${clouds}${reflection}${fish}${above}${feet}${waves}${rings}${dabbleBubbles}${splash}${bubble}${rows}${sw}</g>`;
  }, LH * (COPY.fetch.rows.length + 2.2), { pause: 0.25 });

  // 자맥질: 몸을 기울여 머리가 물속으로 → 발장구 → 완전히 잠수해 연못을 떠남 → T_BACK에 솟아오름
  const tipKF = [
    `0%,${pcM(T_DIVE)}%{transform:translateY(0) rotate(0deg)}`,
    `${pcM(T_DIVE + 0.35)}%{transform:translateY(9px) rotate(-106deg)}`,
    `${pcM(T_DIVE + 0.6)}%{transform:translateY(9px) rotate(-98deg)}`,
    `${pcM(T_DIVE + 0.8)}%{transform:translateY(9px) rotate(-108deg)}`,
    `${pcM(T_DIVE + 1.0)}%{transform:translateY(9px) rotate(-98deg)}`,
    `${pcM(T_SINK)}%{transform:translateY(9px) rotate(-106deg)}`,
    `${pcM(T_SINK + 0.4)}%,${pcM(T_BACK)}%{transform:translateY(70px) rotate(-106deg)}`,
    `${pcM(T_BACK + 0.4)}%{transform:translateY(-5px) rotate(5deg)}`,
    `${pcM(T_BACK + 0.7)}%,100%{transform:translateY(0) rotate(0deg)}`,
  ];
  const ringKF = (name, sec) => `@keyframes ${name}{0%,${pcM(sec)}%{opacity:0;transform:scale(.12)}${pcM(sec + 0.1)}%{opacity:.85}${pcM(sec + 1)}%,100%{opacity:0;transform:scale(1)}}`;
  extraCSS.push(`
.dbob{animation:dbob 2.6s ease-in-out infinite}
@keyframes dbob{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
.dtip{animation:dtip ${DP}s ease-in-out infinite}
@keyframes dtip{${tipKF.join('')}}
.wvp1{animation:wv1 4.2s linear infinite}
@keyframes wv1{from{transform:translateX(0)}to{transform:translateX(-24px)}}
.wvp2{animation:wv2 7s linear infinite}
@keyframes wv2{from{transform:translateX(-30px)}to{transform:translateX(0)}}
.cl1{animation:cl 21s ease-in-out infinite alternate}
.cl2{animation:cl 17s ease-in-out infinite alternate-reverse}
@keyframes cl{from{transform:translateX(0)}to{transform:translateX(-14px)}}
.fA{animation:kfA ${DP}s steps(1,end) infinite}
.fB{opacity:0;animation:kfB ${DP}s steps(1,end) infinite}
.fC{opacity:0;animation:kfC ${DP}s steps(1,end) infinite}
.fD{opacity:0;animation:kfD ${DP}s steps(1,end) infinite}
.fE{opacity:0;animation:kfE ${DP}s steps(1,end) infinite}
.fF{opacity:0;animation:kfF ${DP}s steps(1,end) infinite}
${visKF('kfA', W_A, DP)}
${visKF('kfB', W_B, DP)}
${visKF('kfC', W_C, DP)}
${visKF('kfD', W_D, DP)}
${visKF('kfE', W_E, DP)}
${visKF('kfF', W_F, DP)}
.fqk{opacity:0;animation:kfQ ${DP}s steps(1,end) infinite}
${visKF('kfQ', W_D, DP)}
.rp{opacity:0;transform-box:fill-box;transform-origin:center}
.rpA{animation:rpA ${DP}s ease-out infinite}.rpB{animation:rpB ${DP}s ease-out infinite}
.rpC{animation:rpC ${DP}s ease-out infinite}.rpD{animation:rpD ${DP}s ease-out infinite}
${ringKF('rpA', T_DIVE + 0.15)}${ringKF('rpB', T_SINK + 0.1)}${ringKF('rpC', T_BACK + 0.1)}${ringKF('rpD', T_BACK + 0.45)}
.dbub{opacity:0}
.dbub0{animation:dbub ${DP}s linear infinite}
.dbub1{animation:dbub ${DP}s linear .5s infinite}
.dbub2{animation:dbub ${DP}s linear 1.1s infinite}
@keyframes dbub{0%,${pcM(T_DIVE + 0.5)}%{opacity:0;transform:translateY(0)}${pcM(T_DIVE + 0.8)}%{opacity:.9;transform:translateY(-5px)}${pcM(T_DIVE + 1.7)}%{opacity:0;transform:translateY(-16px)}100%{opacity:0}}
.spl{opacity:0;animation:spl ${DP}s linear infinite}
@keyframes spl{0%,${pcM(T_BACK + 0.15)}%{opacity:0;transform:translate(0,0)}${pcM(T_BACK + 0.4)}%{opacity:.95;transform:translate(var(--sx),-12px)}${pcM(T_BACK + 1.1)}%{opacity:0;transform:translate(calc(var(--sx)*1.6),2px)}100%{opacity:0}}
.fish{opacity:0;animation:fish ${DP}s linear infinite}
@keyframes fish{0%,42%{opacity:0;transform:translateX(0)}45%{opacity:.5}66%{opacity:.5}70%,100%{opacity:0;transform:translateX(${Math.round(17 * CW + 40)}px)}}
.scr{opacity:0;animation:scr .09s linear both}
@keyframes scr{0%{opacity:0}5%,95%{opacity:.9}100%{opacity:0}}
.swt{animation:swt 4.4s ease-in-out infinite}
@keyframes swt{0%,14%,100%{transform:translateY(0)}7%{transform:translateY(-4px)}}`);

  // ============ 2) cat about.md ============
  sess.gap(0.4);
  sess.type(COPY.about.cmd, { pause: 0.5 });
  sess.out(COPY.about.lines.map((l) =>
    l.type === 'h'
      ? [[assertCovered(l.text, 'about'), 'magenta', true]]
      : [['  ', null], [assertCovered(l.text, 'about').replace(/▓+/g, (m) => ' '.repeat(m.length)), null]]
  ), { stagger: 0.12, pause: 0.2 });
  // ▓ 자리에 지직거리는 모자이크 오버레이 (height 0 블록 — 커서 이동 없음)
  sess.block((x, y) => COPY.about.lines.map((l, i) => {
    const m = l.type === 'h' ? null : l.text.match(/▓+/);
    if (!m) return '';
    const off = cells('  ' + l.text.slice(0, m.index));
    return mosaic(t, x + off * CW, y - (COPY.about.lines.length - i) * LH, l.text, m[0].length, i, null);
  }).join(''), 0, { pause: 0 });
  sess.block((x, y) => {
    const idx = COPY.about.lines.findIndex((l) => l.type === 'p');
    if (idx < 0) return '';
    const ly = y - (COPY.about.lines.length - idx) * LH;
    const wsel = cells(COPY.about.lines[idx].text) * CW;
    return `<rect class="sel" style="transform-origin:${x + 2 * CW}px 0" x="${x + 2 * CW}" y="${ly - FS}" width="${wsel}" height="${LH - 2}" fill="${t.selection}"/>`;
  }, 0, { pause: 0 });
  extraCSS.push(MOSAIC_CSS + `
.sel{transform:scaleX(0);animation:sel 15s cubic-bezier(.3,0,.2,1) 4s infinite}
@keyframes sel{0%,30%{transform:scaleX(0);opacity:1}40%,58%{transform:scaleX(1);opacity:1}62%,100%{transform:scaleX(1);opacity:0}}`);

  // ============ 2.5) ori ps (서비스 중인 개인 앱 — 프로세스 목록) ============
  sess.gap(0.4);
  sess.type(COPY.apps.cmd, { pause: 0.5 });
  COPY.apps.items.forEach((a, i) => {
    sess.block((x, y) => {
      const id = a.id + ' '.repeat(Math.max(9 - a.id.length, 1));
      const name = assertCovered(a.name, 'app') + ' '.repeat(Math.max(10 - cells(a.name), 1));
      const st = (a.live ? COPY.apps.status.live : COPY.apps.status.prep).padEnd(9, ' ');
      const tone = a.live ? t.green : t.amber;
      const ex = x + (2 + cells(id) + cells(name) + cells(st)) * CW;
      // 심전도: 흐린 밑선 위로 밝은 구간이 흘러간다 (pathLength=100 기준 대시 이동)
      const ecg = `M${ex},${y - 5} h10 l3,-7 l4,13 l3,-6 h12 l3,-7 l4,13 l3,-6 h11`;
      // 서비스 중: 심박 점 + 흐르는 심전도 / 준비 중: 깜빡이는 점 + 평평한 선
      const flat = `M${ex},${y - 5} h70`;
      return `<g class="${a.live ? 'hb' : 'prep'}" style="animation-delay:${(i * 0.4).toFixed(1)}s;transform-box:fill-box;transform-origin:center">${mono(t, x, y, a.live ? '●' : '○', tone)}</g>`
        + line(t, x + 2 * CW, y, [[id, 'cyan', true], [name, null], [st, a.live ? 'green' : 'amber']])
        + `<path d="${a.live ? ecg : flat}" fill="none" stroke="${tone}" stroke-width="1.3" stroke-linejoin="round" opacity="${a.live ? 0.22 : 0.35}"${a.live ? '' : ' stroke-dasharray="3 4"'}/>`
        + (a.live ? `<path class="ecg" style="animation-delay:${(i * 0.4).toFixed(1)}s" pathLength="100" d="${ecg}" fill="none" stroke="${t.green}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>` : '')
        + line(t, ex + 80, y, [[assertCovered(a.desc, 'app-desc'), 'dim']]);
    }, LH, { pause: i === 0 ? 0.2 : 0.08 });
  });
  sess.out([[[assertCovered(COPY.apps.footer(COPY.apps.items.filter((a) => a.live).length, COPY.apps.items.filter((a) => !a.live).length), 'apps-footer'), 'faint']]], { pause: 0.12 });
  extraCSS.push(`
.hb{animation:hb 1.6s ease-in-out infinite}
.prep{animation:prep 2.4s steps(2,jump-none) infinite}
@keyframes prep{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes hb{0%,30%,100%{transform:scale(1);opacity:1}12%{transform:scale(1.45);opacity:.7}}
.ecg{stroke-dasharray:24 76;animation:ecg 1.6s linear infinite}
@keyframes ecg{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}`);

  // ============ 3) ori stats (오리가 섬을 한 바퀴) ============
  sess.gap(0.4);
  sess.type(COPY.stats.cmd, { pause: 0.5 });
  sess.out([[[assertCovered(COPY.stats.heatmapTitle, 'hm'), 'dim']]], { pause: 0.25 });

  const cell = 12; const gap = 3; const step = cell + gap;
  const weeks = s.weeks.slice(-52);
  const counts = weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)).filter((c) => c > 0).sort((a, b) => a - b);
  const qt = (p) => counts.length ? counts[Math.min(Math.floor(p * counts.length), counts.length - 1)] : 1;
  const th = [qt(0.25), qt(0.5), qt(0.75), qt(0.92)];
  const level = (c) => c === 0 ? -1 : c <= th[0] ? 0 : c <= th[1] ? 1 : c <= th[2] ? 2 : c <= th[3] ? 3 : 4;

  const swimStart = T_SPLASH;     // 오리가 앞바다에 착수하는 시각 (마스터 주기 기준)
  const COL_DT = 0.12;            // 열 하나를 지나는 시간
  // 오리는 섬을 한 바퀴 돈다: 앞바다(→) → 오른쪽 끝 → 뒷바다(←, 섬에 가려짐) → 왼쪽 끝
  const SWIM_R = { front: 12.6, back: -4.5, c0: -5, c1: 62 };
  const U_FRONT = SWIM_R.c1 - SWIM_R.c0;
  const U_SIDE = SWIM_R.front - SWIM_R.back;
  const T_LEAVE = T_SPLASH + U_FRONT * COL_DT;    // 앞바다를 다 건너 뛰어오르는 시각
  const T_LAND = T_LEAVE + 1.3;                   // QUACK 무대 착지
  const T_EXIT = T_BACK - 0.4;                    // 무대를 떠남

  // ---- 2:1 정통 아이소메트릭 다이오라마 ----
  // 픽셀아트의 정석 투영: sx=(week-day)*HW, sy=(week+day)*HH (HW:HH=2:1).
  // 슬래브가 떠오른 뒤 기둥들이 왼쪽부터 파도처럼 자라나고,
  // 구름 그림자가 지형 위를 흐르고, 최다 기여일엔 깃발, 마지막 날엔 비콘.
  const HW = 9; const HH = 4.5;      // 아이소 반폭/반높이 (2:1)
  const EXTRUDE = [6, 10, 15, 20, 26];
  const SLAB = 10;                   // 슬래브 두께
  const ISO_ANG = (Math.atan2(HH, HW) * 180 / Math.PI).toFixed(2); // 26.57
  const boardW = 57 * HW + 2 * HW;   // (52-1 + 7-1)*HW + 타일폭
  const boardH = 57 * HH;
  const isoTopPad = 48;              // 최고 기둥 + 뒷바다 오리 여유
  const isoH = isoTopPad + boardH + 2 * HH + SLAB + 46 + 26; // 보드+슬래브+범례
  let duckTrack = null;
  const entStart = sess.t + 0.3;     // 슬래브가 뜬 직후 기둥이 왼쪽부터 자란다
  const LAPSE_DT = 0.1;              // 타임랩스: 주 하나가 솟는 간격
  const lapseAt = (wi) => entStart + wi * LAPSE_DT;
  // 소나기: 주기 막바지에 섬 전체에 구름이 끼고 비·번개 → 직후 섬이 가라앉고 다시 자란다
  const STORM_T = [34.6, 39.6];                                    // 시작·끝(초)
  const STORM = [[2, 1.5, 86], [14, 5, 70], [26, 2.5, 80], [38, 5.5, 72], [48, 1, 88]]; // [주 위치, 요일축 r, 높이]
  const STORM_DRIFT = 6;                                           // 소나기 동안 구름이 흘러가는 거리(주)
  const BOLTS = [[36.4, 1], [38.0, 3]];                            // [번개 시각, 구름 인덱스]
  const CLOUD_LEAD = 1.5;                                          // 성장 구름이 솟는 주보다 앞서가는 거리(주)

  sess.block((x, y) => {
    // 보드 중앙 정렬 원점 (c=0,r=0 타일의 좌측 꼭짓점)
    const x0 = x + Math.round((W - bodyX * 2 - boardW) / 2) + 6 * HW + 6;
    const y0 = y + isoTopPad;
    const pos = (c, r) => [x0 + (c - r) * HW, y0 + (c + r) * HH];
    const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

    // --- 최다 기여일(깃발)·마지막 날(비콘) 찾기 ---
    let maxKey = null; let maxCnt = -1; let lastKey = null;
    weeks.forEach((w, wi) => {
      w.contributionDays.forEach((d) => {
        const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
        if (d.contributionCount > maxCnt) { maxCnt = d.contributionCount; maxKey = `${wi}-${dow}`; }
        lastKey = `${wi}-${dow}`;
      });
    });

    // --- 슬래브 (다이아몬드 플랫폼 + 두께) ---
    const cA = pos(-0.8, -0.8); const cB = pos(52, -0.8);
    const cC = pos(52, 7); const cD = pos(-0.8, 7);
    const down = (p, dy) => [p[0], p[1] + dy];
    const slabTop = dark ? '#131d30' : '#e9e2cf';
    const slabL = dark ? '#0c1424' : shade('#e9e2cf', 0.85);
    const slabR = dark ? '#0e1728' : shade('#e9e2cf', 0.92);
    const slab = `<g class="slabin">
<polygon points="${pt(cA)} ${pt(cB)} ${pt(cC)} ${pt(cD)}" fill="${slabTop}"/>
<polygon points="${pt(cD)} ${pt(cC)} ${pt(down(cC, SLAB))} ${pt(down(cD, SLAB))}" fill="${slabL}"/>
<polygon points="${pt(cB)} ${pt(cC)} ${pt(down(cC, SLAB))} ${pt(down(cB, SLAB))}" fill="${slabR}"/>
</g>`;

    // --- 해안 거품 (수면 = 슬래브 바닥선) ---
    const ringPts = (m) => [pos(-0.8 - m, -0.8 - m), pos(52 + m, -0.8 - m), pos(52 + m, 7 + m), pos(-0.8 - m, 7 + m)]
      .map((p) => pt(down(p, SLAB))).join(' ');
    const foam = `<g class="slabin"><polygon class="foamb" points="${ringPts(2.8)}" fill="${t.cyan}"/><polygon class="foama" points="${ringPts(1.7)}" fill="${t.cyan}"/></g>`;

    // --- 바다: 섬 둘레에 떠다니는 ~ (시드 고정 — 빌드마다 동일) ---
    const lgY = cC[1] + SLAB + 26;
    let wseed = 52;
    const wr = () => ((wseed = (wseed * 16807) % 2147483647) / 2147483647);
    let sea = '';
    for (let i = 0, n = 0; i < 500 && n < 30; i++) {
      const c = -7 + wr() * 68; const r = -7 + wr() * 22;
      if (c > -3 && c < 55 && r > -3.2 && r < 11.2) continue;          // 섬·월 라벨 자리
      const [wx, wy] = pos(c, r);
      if (wx < x || wx > x + (W - bodyX * 2) - 10 || wy < y + 6 || wy > lgY + 14) continue;
      if (wx < x + 170 && wy > lgY - 16) continue;                      // 범례 자리
      sea += `<g class="sea" style="animation-delay:-${(wr() * 8).toFixed(1)}s">${mono(t, wx.toFixed(0), wy.toFixed(0), '~', t.cyan)}</g>`;
      n++;
    }

    // --- 잔디 기둥: 뒤(c+r 작은 대각선)부터 앞으로, 週 단위 그룹 ---
    // 바깥 g = 오리 웨이브(hcol), 안쪽 g = 입장 성장(hin) — transform 충돌 없이 중첩
    const colInner = new Array(52).fill('');
    const tops = {}; // 타일 윗면 중심 좌표 (날씨 연출용)
    weeks.forEach((w, wi) => {
      const days = [...w.contributionDays].sort((a, b) =>
        new Date(a.date).getUTCDay() - new Date(b.date).getUTCDay());
      for (const d of days) {
        const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
        const [tx, ty] = pos(wi, dow);          // 타일 좌측 꼭짓점
        const lv = level(d.contributionCount);
        const h = lv < 0 ? 1.5 : EXTRUDE[lv];
        tops[`${wi}-${dow}`] = [tx + HW, ty - h];
        const topC = lv < 0 ? t.well : t.ramp[lv];
        const leftC = lv < 0 ? shade(t.well, dark ? 0.8 : 0.93) : shade(t.ramp[lv], 0.62);
        const rightC = lv < 0 ? shade(t.well, dark ? 0.66 : 0.87) : shade(t.ramp[lv], 0.42);
        // 윗면(마름모) → 왼면 → 오른면, 모두 2:1 격자에 정렬
        colInner[wi] += `<path d="M${tx},${ty - h} l${HW},${-HH} l${HW},${HH} l${-HW},${HH} Z" fill="${topC}"/>
<path d="M${tx},${ty - h} l0,${h} l${HW},${HH} l0,${-h} Z" fill="${leftC}"/>
<path d="M${tx + HW},${ty + HH - h} l0,${h} l${HW},${-HH} l0,${-h} Z" fill="${rightC}"/>`;
        if (`${wi}-${dow}` === maxKey && maxCnt > 0) {
          // 최다 기여일 — 펄럭이는 깃발
          const fx = tx + HW; const fy = ty - h;
          colInner[wi] += `<rect x="${fx - 0.75}" y="${fy - 13}" width="1.5" height="13" fill="${t.fg}"/>
<g class="flag" style="transform-box:fill-box;transform-origin:left center"><polygon points="${fx + 0.75},${fy - 13} ${fx + 11},${fy - 10.5} ${fx + 0.75},${fy - 8}" fill="${t.amber}"/></g>`;
        }
        if (`${wi}-${dow}` === lastKey) {
          // 마지막 날 — 맥동 비콘
          const bxp = tx + HW; const byp = ty - h - 3;
          colInner[wi] += `<circle class="beacon" style="transform-box:fill-box;transform-origin:center" cx="${bxp}" cy="${byp}" r="4" fill="none" stroke="${t.cyan}" stroke-width="1.5"/>
<circle cx="${bxp}" cy="${byp}" r="1.8" fill="${t.cyan}"/>`;
        }
      }
    });
    let cols = '';
    for (let wi = 0; wi < 52; wi++) {
      // 앞바다의 오리가 이 열과 같은 화면 x를 지나는 순간에 출렁
      const wave = (swimStart + (wi + (SWIM_R.front - 3) - SWIM_R.c0) * COL_DT).toFixed(2);
      // hin: 1년 타임랩스 — 주마다 제 차례에 솟고, 주기 끝에 한꺼번에 가라앉는다 (주별 키프레임 lp{wi})
      cols += `<g class="hcol" style="animation-delay:${wave}s;transform-box:fill-box;transform-origin:50% 100%"><g class="hin" style="animation:lp${wi} ${M}s linear infinite">${colInner[wi]}</g></g>`;
    }

    // --- 날씨: 구름·비·그림자는 한 몸으로 움직인다 (그림자만 슬래브에 클립) ---
    // 성장 구름: 타임랩스 앞머리를 따라가며 비를 뿌리고, 그 뒤로 잔디가 솟는다. 오늘 기여가 끊겼으면 최근 주 위에 남아 계속 물을 준다.
    const cloudClip = `<clipPath id="slabClip"><polygon points="${pt(cA)} ${pt(cB)} ${pt(cC)} ${pt(cD)}"/></clipPath>`;
    const cloudUnit = (r, lift) => {
      const [cx0, cy0] = pos(0, r);
      const top = mono(t, cx0 - 22, cy0 - lift - 13, ' .-~~~-.', t.dim) + mono(t, cx0 - 22, cy0 - lift, '(_______)', t.dim)
        + [0, 1, 2, 3, 4, 5].map((k) => `<g class="rain" style="--fall:${lift - 24}px;animation-delay:-${(k * 0.17).toFixed(2)}s">${mono(t, cx0 - 14 + k * 8, cy0 - lift + 18, "'", t.cyan)}</g>`).join('');
      const sh = `<ellipse cx="${cx0 + HW}" cy="${cy0}" rx="36" ry="13" transform="rotate(${ISO_ANG} ${cx0 + HW} ${cy0})" fill="#000" opacity="${dark ? 0.24 : 0.1}"/>`;
      return { top, sh };
    };
    const grow = cloudUnit(3, 74);
    const storm = STORM.map(([, r, lift]) => cloudUnit(r, lift));
    const clouds = `<g clip-path="url(#slabClip)"><g class="gcl">${grow.sh}</g>${storm.map((u, k) => `<g class="st${k}">${u.sh}</g>`).join('')}</g>`;
    // 번개: 해당 구름이 그 시각에 있는 자리에서 지면으로
    const bolts = BOLTS.map(([bt, k], i) => {
      const [o, r, lift] = STORM[k];
      const f = (bt - STORM_T[0]) / (STORM_T[1] - STORM_T[0]);
      const [bx0, by0] = pos(o + STORM_DRIFT * f, r);
      const top = by0 - lift + 6;
      return `<polyline class="bolt bolt${i}" points="${bx0 + 8},${top} ${bx0 - 2},${top + (lift - 6) * 0.45} ${bx0 + 7},${top + (lift - 6) * 0.5} ${bx0 - 4},${by0 - 4}" fill="none" stroke="${t.amber}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join('');
    // 비 맞은 자리에서 새싹(+)이 돋는다 (오늘 기여가 끊긴 날만)
    const sprouts = s.streak === 0 ? ['51-1', '50-2', '50-4', '49-3', '51-3', '49-5'].filter((k) => tops[k]).map((k, i) =>
      `<g class="sprout" style="animation-delay:-${(i * 0.4).toFixed(1)}s">${mono(t, tops[k][0] - 3.5, tops[k][1] - 2, '+', t.green)}</g>`).join('') : '';
    const weather = `<g class="sprg">${sprouts}</g>` + bolts + `<g class="gcl">${grow.top}</g>` + storm.map((u, k) => `<g class="st${k}">${u.top}</g>`).join('');

    // --- 월 라벨 (앞-왼쪽 모서리 바깥, 아이소 각도 그대로) ---
    let labels = '';
    let prevMonth = -1;
    weeks.forEach((w, wi) => {
      const m = Number(w.contributionDays[0].date.slice(5, 7));
      if (m !== prevMonth) {
        const [lx, ly] = pos(wi + 0.2, 8.6);
        // 타임랩스가 이 달을 지나는 동안 라벨이 밝아진다
        labels += `<text style="animation:ml${monthStarts.length} ${M}s steps(1,end) infinite" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="10" fill="${t.faint}" transform="rotate(${ISO_ANG} ${lx.toFixed(1)} ${ly.toFixed(1)})">${m}월</text>`;
        monthStarts.push({ wi, ym: w.contributionDays[0].date.slice(0, 7) });
        prevMonth = m;
      }
    });

    // --- 오리의 항로(앞바다)와 착수 물보라. 오리 자체는 화면 전체를 다니는 한 마리라 창 조립 때 맨 위에 그린다 ---
    const at = (c, r) => { const p = pos(c, r); return [p[0] - 17, p[1] - 8]; };
    duckTrack = [at(SWIM_R.c0, SWIM_R.front), at(SWIM_R.c1, SWIM_R.front)];
    const [sx0, sy0] = duckTrack[0];
    const tsplash = [[-16, "'"], [-4, '*'], [10, '.'], [26, '*'], [40, "'"]].map(([dx, ch], i) =>
      `<g class="tspl" style="--sx:${(i - 2) * 7}px">${mono(t, sx0 + dx, sy0 + 4, ch, t.cyan)}</g>`).join('')
      + `<ellipse class="tring" cx="${sx0 + 17}" cy="${sy0 + 8}" rx="42" ry="9" fill="none" stroke="${t.cyan}" stroke-width="1.3"/>`;
    // --- 타임랩스 날짜 표시 (제목 줄 오른쪽 끝): 달이 바뀔 때마다 한 칸씩 넘어간다 ---
    const rdX = x + (W - bodyX * 2) - 7 * CW;
    const readout = `<clipPath id="rdc"><rect x="${rdX - 2}" y="${y - LH - FS}" width="${7 * CW + 4}" height="${LH - 3}"/></clipPath>
<g clip-path="url(#rdc)"><g class="rdo" style="transform:translateY(${-(monthStarts.length - 1) * LH}px)">${monthStarts.map((mm, k) => mono(t, rdX, y - LH + k * LH, mm.ym, t.amber)).join('')}</g></g>`;

    // --- 범례 (미니 아이소 기둥, 왼쪽 아래) ---
    let legend = `<text x="${x}" y="${lgY + 8}" font-size="10" fill="${t.faint}">less</text>`;
    [t.well, ...t.ramp].forEach((c, i) => {
      const lx = x + 36 + i * 17;
      const lh = i === 0 ? 2 : 3 + i * 2;
      legend += `<path d="M${lx},${lgY + 8 - lh} l9,0 l5,-5 l-9,0 Z" fill="${c}"/>
<rect x="${lx}" y="${lgY + 8 - lh}" width="9" height="${lh}" fill="${shade(c, 0.6)}"/>`;
    });
    legend += `<text x="${x + 36 + 6 * 17 + 10}" y="${lgY + 8}" font-size="10" fill="${t.faint}">more</text>`;

    return foam + sea + slab + cloudClip + `<g class="flash">${cols}</g>` + clouds + weather + labels + tsplash + readout + legend;
  }, isoH + LH * 0.4, { pause: 0.1 });

  // 다이오라마 연출: 슬래브 부상 → 기둥 성장 웨이브 → 오리 섬 일주 + 앞바다를 지날 때 週 출렁
  const kp = (v) => ((v * 18) / M).toFixed(2); // 출렁임 길이는 주기와 무관하게 일정
  // 주별 타임랩스 키프레임: 주기 시작 직후 전부 가라앉고 → 왼쪽(1년 전)부터 주 단위로 솟아 → 끝까지 유지
  const lapseKF = Array.from({ length: 52 }, (_, wi) =>
    `@keyframes lp${wi}{0%,${pcM(0.4)}%{opacity:1;transform:translateY(0)}${pcM(1.1)}%,${pcM(lapseAt(wi))}%{opacity:0;transform:translateY(16px);animation-timing-function:cubic-bezier(.25,1.5,.45,1)}${pcM(lapseAt(wi) + 0.42)}%,100%{opacity:1;transform:translateY(0)}}`).join('\n');
  const monthKF = monthStarts.map((mm, k) => {
    const on = pcM(lapseAt(mm.wi));
    const next = monthStarts[k + 1];
    return `@keyframes ml${k}{0%{fill:${t.faint}}${on}%{fill:${t.amber}}${next ? `${pcM(lapseAt(next.wi))}%{fill:${t.dim}}` : ''}100%{fill:${next ? t.dim : t.amber}}}`;
  }).join('\n');
  const rdoKF = `@keyframes rdo{0%{transform:translateY(${-(monthStarts.length - 1) * LH}px)}${pcM(0.8)}%{transform:translateY(0)}`
    + monthStarts.slice(1).map((mm, k) => `${pcM(lapseAt(mm.wi))}%{transform:translateY(${-(k + 1) * LH}px)}`).join('')
    + `100%{transform:translateY(${-(monthStarts.length - 1) * LH}px)}}`;
  // 구름 위치는 주(週) 축을 따라: 한 주 = (HW, HH)px
  const ax = (w) => `transform:translate(${(w * HW).toFixed(1)}px,${(w * HH).toFixed(1)}px)`;
  const stay = s.streak === 0; // 끊긴 날엔 성장 구름이 최근 주 위에 남는다
  const growEnd = lapseAt(51);
  const gclKF = `@keyframes gcl{0%,${pcM(0.4)}%{opacity:${stay ? 1 : 0};${ax(50)}}${pcM(1.0)}%{opacity:0;${ax(50)}}`
    + `${pcM(entStart - 0.4)}%{opacity:0;${ax(CLOUD_LEAD - 1.5)}}${pcM(entStart)}%{opacity:1;${ax(CLOUD_LEAD)}}`
    + (stay
      ? `${pcM(lapseAt(50 - CLOUD_LEAD))}%,100%{opacity:1;${ax(50)}}`
      : `${pcM(growEnd)}%{opacity:1;${ax(51 + CLOUD_LEAD)}}${pcM(growEnd + 1.6)}%,100%{opacity:0;${ax(62)}}`) + '}';
  const [S0, S1] = STORM_T;
  const stormKF = STORM.map(([o], k) =>
    `.st${k}{opacity:0;animation:st${k} ${M}s linear infinite}\n@keyframes st${k}{0%,${pcM(S0 + k * 0.12)}%{opacity:0;${ax(o)}}${pcM(S0 + 0.6 + k * 0.12)}%{opacity:1}${pcM(S1 - 0.6)}%{opacity:1}${pcM(S1)}%,100%{opacity:0;${ax(o + STORM_DRIFT)}}}`).join('\n');
  const flashKF = '@keyframes flash{0%{filter:none}' + BOLTS.map(([bt]) =>
    `${pcM(bt - 0.02)}%{filter:none}${pcM(bt)}%{filter:brightness(${dark ? 2.1 : 1.3})}${pcM(bt + 0.1)}%{filter:none}${pcM(bt + 0.18)}%{filter:brightness(${dark ? 1.6 : 1.18})}${pcM(bt + 0.28)}%{filter:none}`).join('') + '100%{filter:none}}';
  const weatherCSS = `.gcl{animation:gcl ${M}s linear infinite}
${gclKF}
${stormKF}
.flash{animation:flash ${M}s linear infinite}
${flashKF}
.bolt{opacity:0}
.sprg{opacity:0;animation:sprg ${M}s steps(1,end) infinite}
${visKF('sprg', [[growEnd + 0.6, M]], M)}
${BOLTS.map(([bt], i) => `.bolt${i}{animation:bolt${i} ${M}s steps(1,end) infinite}\n${visKF(`bolt${i}`, [[bt, bt + 0.1], [bt + 0.18, bt + 0.28]], M)}`).join('\n')}`;
  const shadowA = dark ? 0.45 : 0.22;
  extraCSS.push(`
.slabin{animation:slabin .6s cubic-bezier(.2,.7,.2,1) ${(entStart - 0.25).toFixed(2)}s both}
@keyframes slabin{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.hin{opacity:1}
${lapseKF}
${monthKF}
.rdo{animation:rdo ${M}s steps(1,end) infinite}
${rdoKF}
.tspl{opacity:0;animation:tspl ${M}s linear infinite}
@keyframes tspl{0%,${pcM(T_SPLASH - 0.05)}%{opacity:0;transform:translate(0,0)}${pcM(T_SPLASH + 0.2)}%{opacity:1;transform:translate(var(--sx),-16px)}${pcM(T_SPLASH + 0.8)}%,100%{opacity:0;transform:translate(calc(var(--sx)*1.7),4px)}}
.tring{opacity:0;transform-box:fill-box;transform-origin:center;animation:tring ${M}s ease-out infinite}
@keyframes tring{0%,${pcM(T_SPLASH)}%{opacity:0;transform:scale(.15)}${pcM(T_SPLASH + 0.1)}%{opacity:.9}${pcM(T_SPLASH + 1.3)}%,100%{opacity:0;transform:scale(1)}}
.sprout{opacity:0;animation:sprout 2.4s ease-in-out infinite}
@keyframes sprout{0%,100%{opacity:0;transform:translateY(2px)}45%{opacity:1;transform:translateY(-3px)}}
.hcol{animation:isow ${M}s linear infinite}
@keyframes isow{
0%{transform:none;filter:none}
${kp(0.8)}%{transform:translateY(-8px);filter:brightness(1.5) drop-shadow(0 7px 5px rgba(0,0,0,${shadowA}))}
${kp(1.8)}%{transform:translateY(2px);filter:brightness(1.05)}
${kp(2.7)}%{transform:translateY(-2px);filter:brightness(1.18)}
${kp(3.6)}%{transform:translateY(0);filter:none}
100%{transform:none;filter:none}}
.foama{opacity:.1;animation:foama 5s ease-in-out infinite}
@keyframes foama{0%,100%{opacity:.1}50%{opacity:.04}}
.foamb{opacity:.05;animation:foamb 5s ease-in-out infinite}
@keyframes foamb{0%,100%{opacity:.03}50%{opacity:.08}}
.sea{opacity:0;animation:sea 8s ease-in-out infinite}
@keyframes sea{0%{opacity:0;transform:translateX(-5px)}35%,65%{opacity:.3}100%{opacity:0;transform:translateX(7px)}}
${weatherCSS}
.rain{animation:rain 1s linear infinite}
@keyframes rain{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}80%{opacity:.7}100%{opacity:0;transform:translate(-8px,var(--fall))}}
.fw{opacity:0;animation:fw 4.5s ease-out infinite}
@keyframes fw{0%{opacity:0;transform:rotate(var(--a)) translateX(2px)}3%{opacity:1}22%{opacity:0;transform:rotate(var(--a)) translateX(17px)}100%{opacity:0;transform:rotate(var(--a)) translateX(17px)}}
.odo{animation:odo 1.5s cubic-bezier(.16,.9,.2,1) both}
@keyframes odo{from{transform:translateY(0)}}
.flag{animation:flagwave 1s ease-in-out infinite alternate}
@keyframes flagwave{from{transform:scaleX(1)}to{transform:scaleX(.82)}}
.beacon{animation:beacon 2.2s ease-out infinite}
@keyframes beacon{0%{transform:scale(.5);opacity:1}70%{opacity:.25}100%{transform:scale(2.4);opacity:0}}
.grow{animation:growx .8s cubic-bezier(.2,.7,.2,1) both}
.sheen{animation:sheen 13s ease-in-out infinite}
@keyframes sheen{0%{transform:translateX(0)}9%,100%{transform:translateX(var(--w))}}
@keyframes growx{from{transform:scaleX(0)}to{transform:scaleX(1)}}`);

  // 수치 행
  const label = (k) => [assertCovered(k, 'label') + ' '.repeat(Math.max(12 - cells(k), 1)), 'dim'];
  const ratio = s.lastYearTotal > 0 ? s.thisYearTotal / s.lastYearTotal : 1;
  const beaten = s.lastYearTotal > 0 && s.thisYearTotal >= s.lastYearTotal;
  sess.gap(0.5);
  const barX = bodyX + 20 * CW;
  const barW = 240;
  const odoStart = sess.t + 0.2 / SPEED;
  sess.block((x, y) => {
    const pct = `${Math.round(ratio * 100)}%`;
    return line(t, x, y, [label(COPY.stats.rows.contrib)])
      + odometer(t, x + 12 * CW, y, fmt(s.thisYearTotal), odoStart)
      + bar(t, barX, y - FS + 2, barW, FS - 1, ratio, t.data.green, { id: 'shc', delay: odoStart + 1.2 })
      + (beaten ? [0, 45, 90, 135, 180, 225, 270, 315].map((a, k) =>
        `<rect class="fw" style="--a:${a}deg;transform-origin:${barX + barW}px ${y - 5.5}px;animation-delay:${(odoStart + 1.4 + (k % 2) * 0.08).toFixed(2)}s" x="${barX + barW}" y="${y - 6.5}" width="4" height="2" rx="1" fill="${k % 2 ? t.amber : t.magenta}"/>`).join('') : '')
      + line(t, barX + barW + 10, y, [
        [pct, beaten ? 'amber' : null, beaten],
        [` · ${s.year - 1}년 ${fmt(s.lastYearTotal)} 대비`, 'dim'],
      ]);
  }, LH);
  sess.out([
    [label(COPY.stats.rows.streak), [assertCovered(COPY.stats.rows.streakFmt(s.streak, s.longestStreak), 'streak'), null]],
    [label(COPY.stats.rows.meta), [assertCovered(COPY.stats.rows.metaFmt(s.repos, s.stars, s.followers), 'meta'), null]],
  ], { stagger: 0.12, pause: 0.1 });

  // 언어 게이지
  sess.gap(0.5);
  sess.out([[[assertCovered(COPY.stats.rows.langs, 'langs'), 'dim']]], { pause: 0.15 });
  const usedHues = new Set();
  const hueOf = (name) => {
    let hue = LANG_HUES[name];
    if (!hue || usedHues.has(hue)) hue = HUE_FALLBACK.find((h) => !usedHues.has(h)) ?? 'cyan';
    usedHues.add(hue);
    return t.data[hue];
  };
  const maxPct = Math.max(...s.langs.map((l) => l.pct), 1);
  s.langs.forEach((l, i) => {
    const color = hueOf(l.name);
    const lStart = sess.t + (i === 0 ? 0.15 : 0.04) / SPEED;
    sess.block((x, y) => {
      const padded = l.name.slice(0, 13) + ' '.repeat(Math.max(14 - l.name.length, 1));
      return line(t, x, y, [[padded, null]])
        + bar(t, x + 15 * CW, y - FS + 2, 300, FS - 1, l.pct / maxPct, color, { id: `shl${i}`, delay: lStart + 1.6 + i * 0.18 })
        + odometer(t, x + 15 * CW + 310, y, `${l.pct.toFixed(1)}%`, lStart + 0.1, { id: `odl${i}`, fill: t.dim, bold: false });
    }, LH, { pause: i === 0 ? 0.15 : 0.04 });
  });
  const mood = s.streak === 0 ? COPY.stats.moods.zero
    : s.streak >= 14 ? COPY.stats.moods.hot(s.streak)
      : COPY.stats.moods.normal;
  sess.out([[[assertCovered(mood, 'mood'), 'green']]], { pause: 0.2 });

  // ============ 4) ori repos --recent ============
  sess.gap(0.4);
  sess.type(COPY.repos.cmd, { pause: 0.5 });
  const MAXC = Math.floor((W - bodyX * 2) / CW);
  if (!s.recent.length) {
    sess.out([[[assertCovered(COPY.repos.empty, 'repos-empty'), 'dim']]], { pause: 0.25 });
  } else {
    const rows = s.recent.map((r) => {
      const meta = `  ${r.lang ? r.lang + ' · ' : ''}${relAgo(r.pushedAt, now)}`;
      // 비공개 레포는 이름을 글자수만 맞춘 모자이크로 (실제 ▓는 오버레이가 그림)
      // 조직 소유는 회사 프로젝트 문구, 설명 없는 공개 레포는 대체 문구
      const dispName = r.private ? ' '.repeat(maskLen(r.name)) : r.name;
      const head = 2 + r.oid.length + 2 + dispName.length + 2;
      let desc = r.private
        ? assertCovered(r.org ? COPY.repos.orgDesc : COPY.repos.privateDesc, 'repo-private')
        : (r.desc || assertCovered(COPY.repos.noDesc, 'repo-nodesc'));
      const budget = MAXC - head - cells(meta) - 1;
      while (desc && cells(desc) > budget) desc = desc.slice(0, -2).trimEnd() + '…';
      return [
        ['* ', 'green'], [r.oid, 'amber'],
        [' (', 'dim'], [dispName, 'cyan', true], [') ', 'dim'],
        [desc, r.private || !r.desc ? 'dim' : null], [meta, 'dim'],
      ];
    });
    const graphStart = sess.t + 0.25 / SPEED;
    sess.out(rows, { stagger: 0.09, pause: 0.25 });
    if (s.recent.length > 1) {
      sess.block((x, y) => {
        const n = s.recent.length;
        const gx = x + CW / 2;
        const ry = (i) => y - (n - i) * LH;
        let d = '';
        for (let i = 0; i < n - 1; i++) d += `M${gx},${ry(i) + 1} V${ry(i + 1) - 11}`;
        return `<path class="ggraph" style="animation-delay:${graphStart.toFixed(2)}s" pathLength="100" d="${d}" fill="none" stroke="${t.green}" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>
<circle class="gdot" cx="${gx}" cy="${ry(0) - 5}" r="2.6" fill="${t.amber}" style="--d:${(n - 1) * LH}px"/>`;
      }, 0, { pause: 0 });
      extraCSS.push(`
.ggraph{stroke-dasharray:100;animation:ggraph 1.1s ease-out both}
@keyframes ggraph{from{stroke-dashoffset:100}}
.gdot{opacity:0;animation:gdot 5s cubic-bezier(.5,0,.5,1) 3s infinite}
@keyframes gdot{0%{opacity:0;transform:translateY(0)}6%{opacity:1}34%{opacity:1;transform:translateY(var(--d))}40%,100%{opacity:0;transform:translateY(var(--d))}}`);
    }
    // 비공개 레포 이름 자리에 지직거리는 모자이크 오버레이
    const priv = s.recent.map((r, i) => ({ r, i })).filter(({ r }) => r.private);
    if (priv.length) {
      sess.block((x, y) => priv.map(({ r, i }, k) =>
        mosaic(t, x + (2 + r.oid.length + 2) * CW, y - (s.recent.length - i) * LH, r.name, maskLen(r.name), k, 'cyan')
      ).join(''), 0, { pause: 0 });
    }
  }
  sess.out([[[assertCovered(COPY.repos.footer, 'repos-footer'), 'faint']]], { pause: 0.15 });

  // ============ 5) ori quack --max (피날레, 무한 루프) ============
  sess.gap(0.5);
  sess.type(COPY.party.cmd, { pause: 0.6 });

  const PARTY_H = 190;
  const partyStart = sess.t + 0.3 / SPEED;
  sess.block((x, y) => {
    const cx = W / 2;
    // 픽셀 QUACK! (hue 순환)
    const bcell = 7;
    const bannerW = 6 * 6 * bcell - bcell;
    const bx = cx - bannerW / 2;
    const banner = pixelBanner('QUACK!', bx, y + 8, bcell, t.data.magenta, partyStart);
    // EQ 바 12개
    const eqY = y + 8 + 7 * bcell + 26;
    const eqColors = [t.data.cyan, t.data.amber, t.data.magenta, t.data.green, t.data.violet];
    let eq = '';
    for (let i = 0; i < 12; i++) {
      const ex = cx - (12 * 18) / 2 + i * 18;
      eq += `<rect class="eq" style="animation-delay:${(-i * 0.13).toFixed(2)}s;transform-origin:${ex + 6}px ${eqY + 26}px" x="${ex}" y="${eqY}" width="12" height="26" rx="2" fill="${eqColors[i % 5]}"/>`;
    }
    // 색종이 16개
    const confChars = ['*', '+', '·', "'"];
    let conf = '';
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const fx = bx - 90 + rnd() * (bannerW + 180);
      conf += `<g class="conf" style="animation-delay:${(-rnd() * 4.5).toFixed(2)}s">${mono(t, fx, y, confChars[i % 4], eqColors[i % 5])}</g>`;
    }
    // 오리 3마리 군무 (가운데 진하게, 양옆 흐리게)
    const duckArt = (dx, cls, dim) => `<g class="${cls}" style="transform-origin:${dx + 18}px ${eqY + 20}px">
${mono(t, dx, eqY + 6, ',~.', dim ? t.dim : t.amber)}
${mono(t, dx, eqY + 19, '( o)>', dim ? t.dim : t.amber)}
</g>`;
    partySlot = [bx - 120, eqY + 12]; // 여행하는 오리가 착지해 춤추는 자리
    const ducks = duckArt(bx - 170, 'dance d2', true)
      + duckArt(bx - 70, 'dance d3', true)
      + duckArt(bx + bannerW + 60, 'dance d2', true)
      + duckArt(bx + bannerW + 110, 'dance d1', false)
      + `<g class="partyqk">${mono(t, bx - 120, eqY - 10, COPY.party.quack + '!', t.magenta)}</g>`;
    return banner + eq + conf + ducks;
  }, PARTY_H, { pause: 0.3 });

  extraCSS.push(`
.bl{animation:hue 3s linear infinite, blb 1.05s cubic-bezier(.34,1.56,.64,1) infinite}
@keyframes hue{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}
@keyframes blb{0%,100%{transform:translateY(0) scale(1)}35%{transform:translateY(-7px) scale(1.07)}60%{transform:translateY(1.5px) scale(.98)}}
.px{transform-box:fill-box;transform-origin:center;animation:pxin .85s cubic-bezier(.2,.9,.25,1) both}
@keyframes pxin{from{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.eq{animation:eq .62s ease-in-out infinite alternate}
@keyframes eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
.conf{animation:fall 4.5s linear infinite}
@keyframes fall{0%{transform:translate(0,-16px);opacity:0}8%{opacity:1}85%{opacity:.8}100%{transform:translate(14px,${170}px);opacity:0}}
.dance{animation:dance .62s steps(2,jump-none) infinite}
.d2{animation-delay:.31s}
.d3{animation-delay:.15s}
@keyframes dance{0%,100%{transform:translateY(0) }50%{transform:translateY(-7px)}}
.partyqk{opacity:0;animation:partyqk ${M}s steps(1,end) infinite}
${visKF('partyqk', [[T_LAND + 0.5, T_LAND + 1.8], [T_LAND + 2.9, T_LAND + 3.9]], M)}`);

  // ============ 아웃트로 ============
  sess.out([[[assertCovered(COPY.party.outroFmt(s.todayStr), 'outro'), 'faint']]], { pause: 0.3 });
  sess.idle(COPY.idle.ghosts.map((g) => assertCovered(g, 'idle-ghost')));

  // ============ 창 조립 (tmux 탭 대신 ● REC 상태바) ============
  const r = sess.render();
  // 여행하는 오리: 연못 밑에서 빠져나와 구르며 낙하 → 섬 앞바다 착수·횡단 → 포물선으로 뛰어 QUACK 무대 착지·춤 → 퇴장
  const [tA, tB] = duckTrack;
  const apex = [(tB[0] + partySlot[0]) / 2 + 60, tB[1] - 70];
  const tr = (p, extra = '') => `transform:translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)${extra}`;
  const traveler = `<g class="trav"><g class="travspin" style="transform-box:fill-box;transform-origin:center"><g class="swimbob">
${mono(t, 0, -6, ',~.', t.amber)}
${mono(t, 0, 7, '( o)>', t.amber)}</g></g></g>`;
  extraCSS.push(`
.trav{opacity:0;animation:trav ${M}s linear infinite}
@keyframes trav{
0%,${pcM(T_FALL)}%{opacity:0;${tr(pondPt)}}
${pcM(T_FALL + 0.08)}%{opacity:1;${tr(pondPt)};animation-timing-function:cubic-bezier(.45,0,.9,.55)}
${pcM(T_SPLASH)}%{opacity:1;${tr(tA)};animation-timing-function:linear}
${pcM(T_LEAVE)}%{opacity:1;${tr(tB)};animation-timing-function:cubic-bezier(.15,.6,.5,1)}
${pcM(T_LEAVE + 0.5)}%{opacity:1;${tr(apex)};animation-timing-function:cubic-bezier(.5,0,.9,.5)}
${pcM(T_LAND)}%{opacity:1;${tr(partySlot)}}
${pcM(T_LAND + 0.12)}%{opacity:1;${tr([partySlot[0], partySlot[1] + 4])}}
${pcM(T_LAND + 0.25)}%,${pcM(T_EXIT)}%{opacity:1;${tr(partySlot)}}
${pcM(T_EXIT + 0.35)}%,100%{opacity:0;${tr([partySlot[0], partySlot[1] + 34])}}}
.travspin{animation:travspin ${M}s linear infinite}
@keyframes travspin{0%,${pcM(T_FALL)}%{transform:rotate(0deg)}${pcM(T_SPLASH - 0.05)}%,${pcM(T_LEAVE)}%{transform:rotate(360deg)}${pcM(T_LAND - 0.1)}%,100%{transform:rotate(720deg)}}
.swimbob{animation:swimbob .62s steps(2,jump-none) infinite}
@keyframes swimbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`);
  const barH = 26;
  const H = r.endY + 8 + barH + P;
  const chrome = windowChrome(t, {
    w: W, h: H, title: 'Lee-Young-Jae @ github — session replay', activeWin: -1, windows: [], host: '',
  });
  const barY = P + (H - P * 2) - barH;
  const recX = P + 14 + (cells(COPY.bar.session) + 2) * (12 / 2);
  const statusBar = `
<rect x="${P}" y="${barY}" width="${W - P * 2}" height="${barH}" fill="${t.chrome}"/>
${line(t, P + 14, barY + barH / 2 + 4.5, [[COPY.bar.session, 'green', true]], { fs: 12 })}
<g class="rec">${line(t, recX, barY + barH / 2 + 4.5, [[COPY.bar.rec, 'red', true]], { fs: 12 })}</g>
${timecode(t, recX + (cells(COPY.bar.rec) + 1) * 6, barY + barH / 2 + 4.5)}
<text x="${P + (W - P * 2) - 14}" y="${barY + barH / 2 + 4.5}" text-anchor="end" font-size="12" fill="${t.dim}">${esc(COPY.host)}</text>
<g class="stroll"><text x="0" y="${barY + barH / 2 + 5}" font-size="13" xml:space="preserve" fill="${t.amber}">&lt;(o )___</text></g>`;
  extraCSS.push(`
${TIMECODE_CSS}
.rec{animation:rec 1.6s steps(2,jump-none) infinite}
@keyframes rec{0%{opacity:1}50%{opacity:.25}100%{opacity:1}}
.crt{animation:crt .8s cubic-bezier(.2,.8,.2,1) backwards}
@keyframes crt{0%{transform:scale(.02,.002);filter:brightness(7)}40%{transform:scale(1,.004);filter:brightness(7)}100%{transform:scale(1,1);filter:brightness(1)}}
.stroll{animation:stroll 38s linear infinite}
@keyframes stroll{from{transform:translateX(${W * 0.28}px)}to{transform:translateX(${W * 0.72}px)}}`);

  return svgDoc({
    w: W, h: H,
    title: `ori session — ${s.year} 기여 ${fmt(s.thisYearTotal)}`,
    desc: `ori-fetch, 개인 앱 ${COPY.apps.items.length}개, 기여 히트맵(오리가 섬을 한 바퀴), 최근 레포 ${s.recent.length}개, QUACK 피날레까지 한 세션. JS 없이 SVG 한 장.`,
    font: fontFaceCSS('full'),
    style: r.css + extraCSS.join('\n'),
    // 브라운관이 켜지듯: 가운데 밝은 선 → 좌우로 번짐 → 위아래로 펼쳐짐 (끝나면 스타일을 남기지 않는다)
    body: chrome.open + `<g class="crt" style="transform-origin:${W / 2}px ${H / 2}px">` + r.svg + statusBar + traveler + '</g>' + chrome.close,
  });
}

// ------------------------------------------------------------
const stats = await fetchStats();
console.log('stats:', JSON.stringify({ ...stats, weeks: `(${stats.weeks.length} weeks)`, recent: stats.recent.map((r) => r.name) }, null, 2));
for (const t of Object.values(THEMES)) {
  const svg = sessionSvg(t, stats);
  writeFileSync(join(root, `assets/session-${t.id}.svg`), svg);
  console.log(`✔ assets/session-${t.id}.svg`, (svg.length / 1024).toFixed(1) + 'KB');
}
