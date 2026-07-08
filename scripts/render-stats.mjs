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
    recent: repositories(first: 20, privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false, orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes {
        name description pushedAt isArchived
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

  const LANG_EXCLUDE = new Set(['PLpgSQL', 'Roff', 'Makefile', 'Dockerfile', 'Batchfile', 'CMake', 'Jupyter Notebook']);
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
  const recent = u.recent.nodes
    .filter((r) => !r.isArchived && !hide.has(r.name) && r.name !== LOGIN
      && r.description && r.defaultBranchRef?.target?.abbreviatedOid)
    .slice(0, COPY.repos.max)
    .map((r) => ({
      name: r.name,
      desc: sanitizeCovered(r.description),
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

function relAgo(pushedAt, now) {
  const days = Math.max(0, Math.floor((now - new Date(pushedAt).getTime()) / 86400000));
  if (days === 0) return COPY.repos.ago.today;
  if (days < 7) return COPY.repos.ago.days(days);
  if (days < 35) return COPY.repos.ago.weeks(Math.round(days / 7));
  return COPY.repos.ago.months(Math.max(1, Math.round(days / 30)));
}

const mono = (t, tx, ty, str, fill, cls, extra = '') =>
  `<text${cls ? ` class="${cls}"` : ''} x="${tx}" y="${ty}" font-size="14" xml:space="preserve" fill="${fill}"${extra}>${esc(str)}</text>`;

function bar(t, x, y, w, h, ratio, color) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${t.well}"/>
<rect class="grow" x="${x}" y="${y}" width="${Math.max(w * Math.min(ratio, 1), 3).toFixed(1)}" height="${h}" rx="2" fill="${color}" style="transform-origin:${x}px 0"/>`;
}

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
function pixelBanner(word, x, y, cell, fill) {
  // 글자별 그룹 — 무지개 웨이브 + 개별 바운스 (delay 스태거)
  let out = '';
  let cx = x;
  [...word].forEach((ch, li) => {
    const g = PXF[ch];
    let letter = '';
    g.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c === '#') letter += `<rect x="${cx + rx * cell}" y="${y + ry * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`;
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
  const sess = makeSession(t, { x: bodyX, y: bodyY, fs: FS, lh: LH });
  const extraCSS = [];
  const now = Date.now();

  // ============ 1) ori-fetch (로고 오리: 16초 서사 타임라인) ============
  // 부유 바운스(상시) → 깜빡 → 꽥 → 자맥질(엉덩이 하늘로+발장구+기포)
  // → 물 털기 → 날갯짓×2 → 깜빡. 수면 반영 + 구름 + 파문 포함.
  sess.type(COPY.fetch.cmd, { pause: 0.6 });

  const DP = 16; // 마스터 주기(초)
  const D_A = ['        __', '      <(o )____', '       (  ._> /', "        `----'"];
  const D_B = ['        __', '      <(- )____', '       (  ._> /', "        `----'"];
  const D_C = ['        __', '      <(o )____', '       (  .^> /', "        `----'"];
  const D_D = ['        __', '      <(O )____', '       (  ._> /', "        `----'"];
  const D_E = ['          \\/', '        ___((', '       (     )', "        `----'"]; // 자맥질 (발 모아)
  const D_F = ['          /\\', '        ___((', '       (     )', "        `----'"]; // 자맥질 (발 벌려)
  // 가시 구간 (초)
  const W_B = [[3.4, 3.65], [15.5, 15.75]];
  const W_D = [[5.8, 6.7]];
  const W_E = []; const W_F = [];
  for (let i = 0; i < 8; i++) (i % 2 ? W_F : W_E).push([8.2 + i * 0.375, 8.2 + (i + 1) * 0.375]);
  const W_C = [[11.6, 11.9], [12.2, 12.5]];
  const W_A = complementWindows([W_B, W_D, W_E, W_F, W_C], DP);

  const infoX = bodyX + 250;
  sess.block((x, y) => {
    const artX = x + 8;
    const rowY = (i) => y + i * LH;
    const waveY = rowY(4);
    const art = (rows, cls) => `<g class="${cls}">${rows.map((ln, i) =>
      mono(t, artX, rowY(i), ln, t.amber)).join('')}</g>`;
    const framesSvg = art(D_A, 'fA') + art(D_B, 'fB') + art(D_C, 'fC') + art(D_D, 'fD') + art(D_E, 'fE') + art(D_F, 'fF');
    // 구름 (뒤편, 드리프트)
    const clouds = `<g class="cl1">${mono(t, artX + 118, rowY(0) - 8, '.-~~-.', t.faint)}</g>
<g class="cl2">${mono(t, artX + 152, rowY(1) - 2, '.-~.', t.faint)}</g>`;
    // 수면: 부드러운 사인 물결 2겹 (서로 다른 속도/위상으로 드리프트)
    const wvW = 17 * CW + 8;
    const wavePath = (x0, y0, amp, p, n) =>
      `M${x0},${y0} q${p / 4},${amp} ${p / 2},0` + ` t${p / 2},0`.repeat(n);
    const waves = `<clipPath id="wvc"><rect x="${artX - 2}" y="${waveY - 16}" width="${wvW}" height="24"/></clipPath>
<g clip-path="url(#wvc)">
<g class="wvp1"><path d="${wavePath(artX - 26, waveY - 5, 3.2, 24, Math.ceil(wvW / 12) + 4)}" fill="none" stroke="${t.cyan}" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/></g>
<g class="wvp2"><path d="${wavePath(artX - 38, waveY + 1, 2.4, 30, Math.ceil(wvW / 15) + 4)}" fill="none" stroke="${t.cyan}" stroke-width="1.4" stroke-linecap="round" opacity="0.32"/></g>
</g>`;
    // 수면 반영 (거꾸로 비친 오리 — 프레임 클래스 공유로 동기화)
    const reflection = `<g transform="translate(0,${2 * waveY - 10}) scale(1,-1)" opacity="${dark ? 0.14 : 0.1}">${framesSvg}</g>`;
    // 자맥질 기포 (머리 잠긴 자리에서 뽀글뽀글)
    const dabbleBubbles = [[-6, 0, 'o'], [6, -6, '.'], [-14, -10, '.']].map(([dx, dy, ch], i) =>
      `<g class="dbub dbub${i}">${mono(t, artX + 8 * CW + dx, waveY - 4 + dy, ch, t.cyan)}</g>`).join('');
    // 물 털기 + 날갯짓 물방울
    const splash = [[-16, '.'], [-2, "'"], [16, '*'], [34, '.'], [48, "'"]].map(([dx, ch]) =>
      `<g class="spl">${mono(t, artX + 7 * CW + dx, waveY - 14, ch, t.cyan)}</g>`).join('');
    // 꽥 말풍선
    const bubble = `<g class="fqk">${mono(t, artX + 15 * CW + 6, rowY(0) + 4, COPY.party.quack + '!', t.magenta)}</g>`;
    const duck = `<g class="dbob" style="transform-box:fill-box;transform-origin:50% 100%">${framesSvg}</g>`;
    const rows = COPY.fetch.rows.map(([k, v], i) => {
      const padded = k + ' '.repeat(Math.max(10 - cells(k), 1));
      return line(t, infoX, y + i * LH, [[padded, 'green', true], [assertCovered(v, 'fetch'), null]]);
    }).join('');
    const swY = y + COPY.fetch.rows.length * LH - 8;
    const sw = ['green', 'cyan', 'magenta', 'amber', 'red', 'dim', 'fg', 'faint'].map((c, i) =>
      `<rect x="${infoX + i * 26}" y="${swY}" width="20" height="10" rx="2" fill="${t[c]}"/>`).join('');
    const title = line(t, infoX, y - LH, [['ori', 'cyan', true], [' @ ', 'dim'], [COPY.host, 'cyan', true]]);
    const rule = `<rect x="${infoX}" y="${y - LH + 8}" width="${cells('ori @ ' + COPY.host) * CW}" height="1.5" fill="${t.border}"/>`;
    return `${title}${rule}<g transform="translate(0,${LH * 0.9})">${clouds}${reflection}${waves}${duck}${dabbleBubbles}${splash}${bubble}${rows}${sw}</g>`;
  }, LH * (COPY.fetch.rows.length + 2.2), { pause: 0.25 });

  extraCSS.push(`
.dbob{animation:dbob 2.6s ease-in-out infinite}
@keyframes dbob{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(2.5px) scaleY(.972)}}
.wvp1{animation:wv1 4.2s linear infinite}
@keyframes wv1{from{transform:translateX(0)}to{transform:translateX(-24px)}}
.wvp2{animation:wv2 7s linear infinite}
@keyframes wv2{from{transform:translateX(-30px)}to{transform:translateX(0)}}
.cl1{animation:cl 21s ease-in-out infinite alternate}
.cl2{animation:cl 17s ease-in-out infinite alternate-reverse}
@keyframes cl{from{transform:translateX(0)}to{transform:translateX(-14px)}}
.fA{animation:kfA ${DP}s steps(1,end) infinite}
.fB{animation:kfB ${DP}s steps(1,end) infinite}
.fC{animation:kfC ${DP}s steps(1,end) infinite}
.fD{animation:kfD ${DP}s steps(1,end) infinite}
.fE{animation:kfE ${DP}s steps(1,end) infinite}
.fF{animation:kfF ${DP}s steps(1,end) infinite}
${visKF('kfA', W_A, DP)}
${visKF('kfB', W_B, DP)}
${visKF('kfC', W_C, DP)}
${visKF('kfD', W_D, DP)}
${visKF('kfE', W_E, DP)}
${visKF('kfF', W_F, DP)}
.fqk{opacity:0;animation:fqk ${DP}s linear infinite}
@keyframes fqk{0%,35.6%{opacity:0}37%,41%{opacity:1}43%,100%{opacity:0}}
.dbub{opacity:0}
.dbub0{animation:dbub ${DP}s linear infinite}
.dbub1{animation:dbub ${DP}s linear .5s infinite}
.dbub2{animation:dbub ${DP}s linear 1.1s infinite}
@keyframes dbub{0%,51.2%{opacity:0;transform:translateY(0)}53%{opacity:.9;transform:translateY(-5px)}60%{opacity:0;transform:translateY(-16px)}100%{opacity:0}}
.spl{opacity:0;animation:spl ${DP}s linear infinite}
@keyframes spl{0%,69.9%{opacity:0;transform:translateY(0)}71.5%{opacity:.95;transform:translateY(-8px)}78%{opacity:0;transform:translateY(-20px)}100%{opacity:0}}`);

  // ============ 2) cat about.md ============
  sess.gap(0.4);
  sess.type(COPY.about.cmd, { pause: 0.5 });
  sess.out(COPY.about.lines.map((l) =>
    l.type === 'h'
      ? [[assertCovered(l.text, 'about'), 'magenta', true]]
      : [['  ', null], [assertCovered(l.text, 'about'), null]]
  ), { stagger: 0.12, pause: 0.2 });

  // ============ 3) ori stats (오리가 잔디 위를 헤엄침) ============
  sess.gap(0.4);
  sess.type(COPY.stats.cmd, { pause: 0.5 });
  sess.out([[[assertCovered(COPY.stats.heatmapTitle, 'hm'), 'dim']]], { pause: 0.25 });

  const cell = 12; const gap = 3; const step = cell + gap;
  const weeks = s.weeks.slice(-52);
  const counts = weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)).filter((c) => c > 0).sort((a, b) => a - b);
  const qt = (p) => counts.length ? counts[Math.min(Math.floor(p * counts.length), counts.length - 1)] : 1;
  const th = [qt(0.25), qt(0.5), qt(0.75), qt(0.92)];
  const level = (c) => c === 0 ? -1 : c <= th[0] ? 0 : c <= th[1] ? 1 : c <= th[2] ? 2 : c <= th[3] ? 3 : 4;

  const swimStart = sess.t + 1.6; // 히트맵 등장 후 오리 출발
  const SWIM_P = 18;              // 왕복 주기(초)
  const COL_DT = 0.085;           // 열당 통과 간격

  // ---- 플로팅 아이소메트릭 다이오라마 ----
  // 두 축 모두 기울인 진짜 아이소 보드: 주(week) 축 ↗ 우상향, 요일 축 ↘ 화면 앞으로.
  // 두께 있는 슬래브 위에 잔디 기둥, 아래엔 그림자 — 공중에 뜬 미니어처 정원.
  const U = [15.4, -2.8];            // week 축 (오른쪽 위로)
  const V = [8, 7];                  // day 축 (viewer 쪽 아래로)
  const TW = 11;                     // 기둥 윗면 가로
  const EXTRUDE = [5, 9, 13, 17, 22];
  const RISE = Math.abs(51 * U[1]);  // 우상향 상승분
  const DEPTH = 6 * V[1];            // 요일 깊이
  const isoTopPad = 10;
  const SLAB = 9;                    // 슬래브 두께
  const isoH = isoTopPad + 22 + RISE + DEPTH + 16 + SLAB + 16 + 22; // 기둥+상승+깊이+앞면+슬래브+그림자+범례
  let duckTrack = null;              // 오리 이동 경로 (block 안에서 계산 → CSS로)

  sess.block((x, y) => {
    // 보드 원점: 왼쪽 아래(근경)에서 시작해 오른쪽 위(원경)로
    const x0 = x + 10;
    const y0 = y + isoTopPad + 22 + RISE;      // (w=0,d=0) 기둥 밑면
    const pos = (w, d) => [x0 + w * U[0] + d * V[0], y0 + w * U[1] + d * V[1]];

    // --- 슬래브 (마름모 플랫폼 + 두께 + 그림자) ---
    const c00 = pos(-0.55, -0.75); const c10 = pos(51.75, -0.75);
    const c11 = pos(51.75, 6.95); const c01 = pos(-0.55, 6.95);
    const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const slabTop = dark ? '#131d30' : '#e9e2cf';
    const slabFront = dark ? '#0c1424' : shade('#e9e2cf', 0.86);
    const slabSide = dark ? '#0e1728' : shade('#e9e2cf', 0.92);
    const down = (p, dy) => [p[0], p[1] + dy];
    const shadowY = c01[1] + SLAB + 14;
    const slab = `
<ellipse cx="${(c00[0] + c11[0]) / 2}" cy="${shadowY}" rx="${(c10[0] - c00[0]) / 2 * 0.94}" ry="11" fill="#000" opacity="${dark ? 0.32 : 0.14}"/>
<ellipse cx="${(c00[0] + c11[0]) / 2}" cy="${shadowY}" rx="${(c10[0] - c00[0]) / 2 * 0.7}" ry="7" fill="#000" opacity="${dark ? 0.22 : 0.1}"/>
<polygon points="${pt(c00)} ${pt(c10)} ${pt(c11)} ${pt(c01)}" fill="${slabTop}"/>
<polygon points="${pt(c01)} ${pt(c11)} ${pt(down(c11, SLAB))} ${pt(down(c01, SLAB))}" fill="${slabFront}"/>
<polygon points="${pt(c10)} ${pt(c11)} ${pt(down(c11, SLAB))} ${pt(down(c10, SLAB))}" fill="${slabSide}"/>`;

    // --- 월 라벨 (앞 모서리를 따라 경사 그대로) ---
    const angle = (Math.atan2(U[1], U[0]) * 180) / Math.PI;
    let labels = '';
    let prevMonth = -1;
    weeks.forEach((w, wi) => {
      const m = Number(w.contributionDays[0].date.slice(5, 7));
      if (m !== prevMonth) {
        const [lx, ly] = pos(wi, 8.3);
        labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="10" fill="${t.faint}" transform="rotate(${angle.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${m}월</text>`;
        prevMonth = m;
      }
    });

    // --- 잔디 기둥 (원경 週부터 그려 근경이 덮도록 역순) ---
    let cols = '';
    for (let wi = weeks.length - 1; wi >= 0; wi--) {
      const w = weeks[wi];
      let barsSvg = '';
      const days = [...w.contributionDays].sort((a, b) =>
        new Date(a.date).getUTCDay() - new Date(b.date).getUTCDay());
      for (const d of days) {
        const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
        const [bx, by] = pos(wi, dow);            // dow0(일) = 뒷줄(위)
        const lv = level(d.contributionCount);
        const h = lv < 0 ? 2.5 : EXTRUDE[lv];
        const topC = lv < 0 ? t.well : t.ramp[lv];
        const frontC = lv < 0 ? shade(t.well, dark ? 0.82 : 0.94) : shade(t.ramp[lv], 0.6);
        const rightC = lv < 0 ? shade(t.well, dark ? 0.68 : 0.88) : shade(t.ramp[lv], 0.42);
        barsSvg += `<path d="M${bx},${by - h} l${TW},0 l${V[0]},${-V[1]} l${-TW},0 Z" fill="${topC}"/>
<rect x="${bx}" y="${by - h}" width="${TW}" height="${h}" fill="${frontC}"/>
<path d="M${bx + TW},${by - h} l${V[0]},${-V[1]} l0,${h} l${-V[0]},${V[1]} Z" fill="${rightC}"/>`;
      }
      const dl = (swimStart + wi * COL_DT).toFixed(2);
      cols += `<g class="hcol" style="animation-delay:${dl}s;transform-box:fill-box;transform-origin:50% 100%">${barsSvg}</g>`;
    }

    // --- 오리 경로 (근경 왼쪽 아래 → 원경 오른쪽 위 오르막) ---
    const dStart = pos(-4, 2.2);
    const dEnd = pos(56, 2.2);
    duckTrack = { x0: dStart[0], y0: dStart[1] - 30, x1: dEnd[0], y1: dEnd[1] - 30 };
    const duck = `<g class="swim"><g class="swimbob">
${mono(t, 0, -6, ',~.', t.amber)}
${mono(t, 0, 7, '( o)>', t.amber)}
</g>
<text x="-26" y="7" font-size="14" fill="${t.cyan}" opacity="0.55" xml:space="preserve">~</text>
<text x="-42" y="5" font-size="14" fill="${t.cyan}" opacity="0.28" xml:space="preserve">~</text>
</g>`;

    // --- 와이프 인 + 조립 ---
    const clipW = c10[0] - c00[0] + 40;
    const svg = `<clipPath id="hmSweep"><rect class="hmwipe" style="transform-box:fill-box;transform-origin:left" x="${c00[0] - 12}" y="${y - 6}" width="${clipW}" height="${isoH + 30}"/></clipPath>
<g clip-path="url(#hmSweep)">${slab}${labels}${cols}${duck}</g>`;

    // --- 범례 (미니 아이소 기둥, 슬래브 왼쪽 아래) ---
    const lgY = c01[1] + SLAB + 24;
    let legend = `<text x="${x}" y="${lgY + 8}" font-size="10" fill="${t.faint}">less</text>`;
    [t.well, ...t.ramp].forEach((c, i) => {
      const lx = x + 36 + i * 17;
      const lh = i === 0 ? 2 : 3 + i * 2;
      legend += `<path d="M${lx},${lgY + 8 - lh} l9,0 l5,-5 l-9,0 Z" fill="${c}"/>
<rect x="${lx}" y="${lgY + 8 - lh}" width="9" height="${lh}" fill="${shade(c, 0.6)}"/>`;
    });
    legend += `<text x="${x + 36 + 6 * 17 + 10}" y="${lgY + 8}" font-size="10" fill="${t.faint}">more</text>`;
    return svg + legend;
  }, isoH + LH * 0.5, { pause: 0.1 });

  // 다이오라마 웨이브: 오리 통과 주(週)가 통째로 출렁 + 플래시, 오리는 오르막 등반
  const swimCross = (52 * COL_DT).toFixed(2);
  const crossPct = ((swimCross / SWIM_P) * 100).toFixed(1);
  const shadowA = dark ? 0.45 : 0.22;
  extraCSS.push(`
.hmwipe{animation:wipe 1.1s cubic-bezier(.2,.7,.2,1) ${(swimStart - 1.5).toFixed(2)}s both;transform-origin:left}
@keyframes wipe{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.hcol{animation:isow ${SWIM_P}s linear infinite}
@keyframes isow{
0%{transform:none;filter:none}
0.8%{transform:translateY(-9px);filter:brightness(1.5) drop-shadow(0 8px 5px rgba(0,0,0,${shadowA}))}
1.8%{transform:translateY(2px);filter:brightness(1.05)}
2.7%{transform:translateY(-2px);filter:brightness(1.18)}
3.6%{transform:translateY(0);filter:none}
100%{transform:none;filter:none}}
.swim{animation:swim ${SWIM_P}s linear ${swimStart.toFixed(2)}s infinite}
@keyframes swim{0%{transform:translate(${duckTrack.x0.toFixed(1)}px,${duckTrack.y0.toFixed(1)}px)}${crossPct}%{transform:translate(${duckTrack.x1.toFixed(1)}px,${duckTrack.y1.toFixed(1)}px)}100%{transform:translate(${duckTrack.x1.toFixed(1)}px,${duckTrack.y1.toFixed(1)}px)}}
.swimbob{animation:swimbob .7s steps(2,jump-none) infinite}
@keyframes swimbob{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
.grow{animation:growx .8s cubic-bezier(.2,.7,.2,1) both}
@keyframes growx{from{transform:scaleX(0)}to{transform:scaleX(1)}}`);

  // 수치 행
  const label = (k) => [assertCovered(k, 'label') + ' '.repeat(Math.max(12 - cells(k), 1)), 'dim'];
  const ratio = s.lastYearTotal > 0 ? s.thisYearTotal / s.lastYearTotal : 1;
  const beaten = s.lastYearTotal > 0 && s.thisYearTotal >= s.lastYearTotal;
  sess.gap(0.5);
  const barX = bodyX + 20 * CW;
  const barW = 240;
  sess.block((x, y) => {
    const pct = `${Math.round(ratio * 100)}%`;
    return line(t, x, y, [label(COPY.stats.rows.contrib), [fmt(s.thisYearTotal), null, true]])
      + bar(t, barX, y - FS + 2, barW, FS - 1, ratio, t.data.green)
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
    sess.block((x, y) => {
      const padded = l.name.slice(0, 13) + ' '.repeat(Math.max(14 - l.name.length, 1));
      return line(t, x, y, [[padded, null]])
        + bar(t, x + 15 * CW, y - FS + 2, 300, FS - 1, l.pct / maxPct, color)
        + line(t, x + 15 * CW + 310, y, [[`${l.pct.toFixed(1)}%`, 'dim']]);
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
      const head = 2 + r.oid.length + 2 + r.name.length + 2;
      let desc = r.desc;
      const budget = MAXC - head - cells(meta) - 1;
      while (desc && cells(desc) > budget) desc = desc.slice(0, -2).trimEnd() + '…';
      return [
        ['* ', 'green'], [r.oid, 'amber'],
        [' (', 'dim'], [r.name, 'cyan', true], [') ', 'dim'],
        [desc, null], [meta, 'dim'],
      ];
    });
    sess.out(rows, { stagger: 0.09, pause: 0.25 });
  }
  sess.out([[[assertCovered(COPY.repos.footer, 'repos-footer'), 'faint']]], { pause: 0.15 });

  // ============ 5) ori quack --max (피날레, 무한 루프) ============
  sess.gap(0.5);
  sess.type(COPY.party.cmd, { pause: 0.6 });

  const PARTY_H = 190;
  sess.block((x, y) => {
    const cx = W / 2;
    // 픽셀 QUACK! (hue 순환)
    const bcell = 7;
    const bannerW = 6 * 6 * bcell - bcell;
    const bx = cx - bannerW / 2;
    const banner = pixelBanner('QUACK!', bx, y + 8, bcell, t.data.magenta);
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
    const ducks = duckArt(bx - 120, 'dance d1', false)
      + duckArt(bx - 170, 'dance d2', true)
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
.eq{animation:eq .62s ease-in-out infinite alternate}
@keyframes eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
.conf{animation:fall 4.5s linear infinite}
@keyframes fall{0%{transform:translate(0,-16px);opacity:0}8%{opacity:1}85%{opacity:.8}100%{transform:translate(14px,${170}px);opacity:0}}
.dance{animation:dance .62s steps(2,jump-none) infinite}
.d2{animation-delay:.31s}
.d3{animation-delay:.15s}
@keyframes dance{0%,100%{transform:translateY(0) }50%{transform:translateY(-7px)}}
.partyqk{opacity:0;animation:partyqk 5s linear infinite}
@keyframes partyqk{0%,55%{opacity:0}58%,75%{opacity:1}78%,100%{opacity:0}}`);

  // ============ 아웃트로 ============
  sess.out([[[assertCovered(COPY.party.outroFmt(s.todayStr), 'outro'), 'faint']]], { pause: 0.3 });
  sess.idle();

  // ============ 창 조립 (tmux 탭 대신 ● REC 상태바) ============
  const r = sess.render();
  const barH = 26;
  const H = r.endY + 8 + barH + P;
  const chrome = windowChrome(t, {
    w: W, h: H, title: 'ori@github — session replay', activeWin: -1, windows: [], host: '',
  });
  const barY = P + (H - P * 2) - barH;
  const recX = P + 14 + (cells(COPY.bar.session) + 2) * (12 / 2);
  const statusBar = `
<rect x="${P}" y="${barY}" width="${W - P * 2}" height="${barH}" fill="${t.chrome}"/>
${line(t, P + 14, barY + barH / 2 + 4.5, [[COPY.bar.session, 'green', true]], { fs: 12 })}
<g class="rec">${line(t, recX, barY + barH / 2 + 4.5, [[COPY.bar.rec, 'red', true]], { fs: 12 })}</g>
<text x="${P + (W - P * 2) - 14}" y="${barY + barH / 2 + 4.5}" text-anchor="end" font-size="12" fill="${t.dim}">${esc(COPY.host)}</text>
<g class="stroll"><text x="0" y="${barY + barH / 2 + 5}" font-size="13" xml:space="preserve" fill="${t.amber}">&lt;(o )___</text></g>`;
  extraCSS.push(`
.rec{animation:rec 1.6s steps(2,jump-none) infinite}
@keyframes rec{0%{opacity:1}50%{opacity:.25}100%{opacity:1}}
.stroll{animation:stroll 38s linear infinite}
@keyframes stroll{from{transform:translateX(${W * 0.28}px)}to{transform:translateX(${W * 0.72}px)}}`);

  return svgDoc({
    w: W, h: H,
    title: `ori session — ${s.year} 기여 ${fmt(s.thisYearTotal)}`,
    desc: `ori-fetch, 기여 히트맵(오리가 헤엄침), 최근 레포 ${s.recent.length}개, QUACK 피날레까지 한 세션.`,
    font: fontFaceCSS('full'),
    style: r.css + extraCSS.join('\n'),
    body: chrome.open + r.svg + statusBar + chrome.close,
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
