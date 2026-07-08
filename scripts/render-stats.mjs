// ============================================================
//  ORI TERMINAL — `ori stats` (동적, tmux 창 1:stats)
//  GitHub GraphQL → 히트맵/게이지가 담긴 터미널 출력 SVG
//  usage: GITHUB_TOKEN=... node scripts/render-stats.mjs
// ============================================================
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  THEMES, LANG_HUES, HUE_FALLBACK, line, windowChrome, makeSession, svgDoc, cells,
} from './theme.mjs';
import { fontFaceCSS, assertCovered } from './fonts.mjs';
import { COPY } from './copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = 'Lee-Young-Jae';

// HUD_TOKEN(PAT, 비공개 기여 포함) > GITHUB_TOKEN(Actions 기본)
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

  return {
    year, todayStr, weeks,
    thisYearTotal: u.thisYear.contributionCalendar.totalContributions,
    lastYearTotal: u.lastYear.contributionCalendar.totalContributions,
    rollingTotal: u.rolling.contributionCalendar.totalContributions,
    streak: current, longestStreak: longest,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    followers: u.followers.totalCount,
    langs,
  };
}

// ------------------------------------------------------------
// 렌더
// ------------------------------------------------------------
const fmt = (n) => n.toLocaleString('en-US');
const W = 1000;
const FS = 14;
const LH = 22;
const CW = FS / 2;

function heatmap(t, s, x, y) {
  const cell = 12; const gap = 3; const step = cell + gap;
  const weeks = s.weeks.slice(-52);
  // 레벨 경계: 0 제외 분위수
  const counts = weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)).filter((c) => c > 0).sort((a, b) => a - b);
  const qt = (p) => counts.length ? counts[Math.min(Math.floor(p * counts.length), counts.length - 1)] : 1;
  const th = [qt(0.25), qt(0.5), qt(0.75), qt(0.92)];
  const level = (c) => c === 0 ? -1 : c <= th[0] ? 0 : c <= th[1] ? 1 : c <= th[2] ? 2 : c <= th[3] ? 3 : 4;

  let svg = '';
  // 월 라벨
  let prevMonth = -1;
  weeks.forEach((w, wi) => {
    const first = w.contributionDays[0];
    const m = Number(first.date.slice(5, 7));
    if (m !== prevMonth) {
      svg += `<text x="${x + wi * step}" y="${y}" font-size="10" fill="${t.faint}">${m}월</text>`;
      prevMonth = m;
    }
  });
  // 셀 — 개별 애니메이션 금지(Chromium 페이지당 애니메이션 버짓 소진 방지),
  // 히트맵 전체를 클립 스윕 1개로 와이프-인
  const gridW = weeks.length * step;
  let cellsSvg = '';
  weeks.forEach((w, wi) => {
    w.contributionDays.forEach((d) => {
      const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
      const lv = level(d.contributionCount);
      const fill = lv < 0 ? t.well : t.ramp[lv];
      cellsSvg += `<rect x="${x + wi * step}" y="${y + 8 + dow * step}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}"/>`;
    });
  });
  svg += `<clipPath id="hmSweep"><rect class="hmwipe" style="transform-box:fill-box;transform-origin:left" x="${x}" y="${y}" width="${gridW}" height="${8 + 7 * step + 8}"/></clipPath>
<g clip-path="url(#hmSweep)">${cellsSvg}</g>`;
  // 범례
  const lgY = y + 8 + 7 * step + 6;
  svg += `<text x="${x}" y="${lgY + 9}" font-size="10" fill="${t.faint}">less</text>`;
  [t.well, ...t.ramp].forEach((c, i) => {
    svg += `<rect x="${x + 34 + i * 16}" y="${lgY}" width="12" height="12" rx="2.5" fill="${c}"/>`;
  });
  svg += `<text x="${x + 34 + 6 * 16 + 6}" y="${lgY + 9}" font-size="10" fill="${t.faint}">more</text>`;
  return { svg, h: 8 + 7 * step + 24 };
}

function bar(t, x, y, w, h, ratio, color) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${t.well}"/>
<rect class="grow" x="${x}" y="${y}" width="${Math.max(w * Math.min(ratio, 1), 3).toFixed(1)}" height="${h}" rx="2" fill="${color}" style="transform-origin:${x}px 0"/>`;
}

function statsSvg(t, s) {
  const P = 12;
  const bodyX = P + 30;
  const bodyY = P + 30 + 34;
  const sess = makeSession(t, { x: bodyX, y: bodyY, fs: FS, lh: LH });

  sess.type(COPY.stats.cmd, { pause: 0.5 });

  // 히트맵
  sess.out([[[assertCovered(COPY.stats.heatmapTitle, 'hm'), 'dim']]], { pause: 0.25 });
  let hmH = 0;
  sess.block((x, y) => {
    const r = heatmap(t, s, x, y);
    hmH = r.h;
    return r.svg;
  }, 8 + 7 * 15 + 24 + LH * 0.6, { pause: 0.1 });

  // 수치 행 (라벨 열 폭 = 12셀)
  const label = (k) => [assertCovered(k, 'label') + ' '.repeat(Math.max(12 - cells(k), 1)), 'dim'];
  const ratio = s.lastYearTotal > 0 ? s.thisYearTotal / s.lastYearTotal : 1;
  const beaten = s.lastYearTotal > 0 && s.thisYearTotal >= s.lastYearTotal;

  sess.gap(0.5);
  const barX = bodyX + 20 * CW;
  const barW = 240;
  sess.block((x, y) => {
    const rowY = y;
    const pct = `${Math.round(ratio * 100)}%`;
    return line(t, x, rowY, [
      label(COPY.stats.rows.contrib),
      [fmt(s.thisYearTotal), null, true],
    ]) + bar(t, barX, rowY - FS + 2, barW, FS - 1, ratio, t.data.green)
      + line(t, barX + barW + 10, rowY, [
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

  // 무드 + 싱크
  const mood = s.streak === 0 ? COPY.stats.moods.zero
    : s.streak >= 14 ? COPY.stats.moods.hot(s.streak)
      : COPY.stats.moods.normal;
  sess.gap(0.5);
  sess.out([
    [[assertCovered(mood, 'mood'), 'green']],
    [[assertCovered(COPY.stats.footerFmt(s.todayStr), 'sync'), 'faint']],
  ], { stagger: 0.2, pause: 0.2 });
  sess.idle();

  const r = sess.render();
  const tmuxH = 26;
  const H = r.endY + 14 + tmuxH + P;
  const chrome = windowChrome(t, {
    w: W, h: H, title: 'ori@github — tmux', activeWin: 1,
    windows: COPY.tmux.windows, host: COPY.host,
  });

  const style = r.css + `
.hmwipe{animation:wipe 1.1s cubic-bezier(.2,.7,.2,1) 1.9s both;transform-origin:left}
@keyframes wipe{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.grow{animation:growx .8s cubic-bezier(.2,.7,.2,1) both}
@keyframes growx{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){ .hmwipe,.grow{animation:none} }`;

  return svgDoc({
    w: W, h: H,
    title: `ori stats — ${s.year} 기여 ${fmt(s.thisYearTotal)}`,
    desc: `기여 ${s.thisYearTotal}, 스트릭 ${s.streak}일(최장 ${s.longestStreak}일), 레포 ${s.repos}, 스타 ${s.stars}, 팔로워 ${s.followers}`,
    font: fontFaceCSS('full'),
    style,
    body: chrome.open + r.svg + chrome.close,
  });
}

// ------------------------------------------------------------
const stats = await fetchStats();
console.log('stats:', JSON.stringify({ ...stats, weeks: `(${stats.weeks.length} weeks)` }, null, 2));
for (const t of Object.values(THEMES)) {
  const svg = statsSvg(t, stats);
  writeFileSync(join(root, `assets/stats-${t.id}.svg`), svg);
  console.log(`✔ assets/stats-${t.id}.svg`, (svg.length / 1024).toFixed(1) + 'KB');
}
