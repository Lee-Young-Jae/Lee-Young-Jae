// ============================================================
//  ORI ARCADE — STATUS WINDOW (동적 HUD)
//  GitHub GraphQL → 게임 상태창 SVG (dark/light)
//  usage: GITHUB_TOKEN=... node scripts/render-hud.mjs
//  GitHub Actions에서 매일 실행되어 assets/hud-*.svg 를 갱신한다.
// ============================================================
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  THEMES, LANG_HUES, HUE_FALLBACK, FONT5,
  bitmapRects, pixelText, pixelTextWidth, pixelFrame, svgDoc, esc,
} from './theme.mjs';
import { fontFaceCSS, KFONT } from './fonts.mjs';
import { COPY } from './copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = 'Lee-Young-Jae';
const FIRST_YEAR = 2021; // 깃헙 계정 생성 연도 (레벨 기준)

// HUD_TOKEN(PAT, 비공개 기여 포함) > GITHUB_TOKEN(Actions 기본) 순으로 사용
const TOKEN = process.env.HUD_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN이 필요합니다. (로컬: GITHUB_TOKEN=$(gh auth token) node scripts/render-hud.mjs)');
  process.exit(1);
}

// 서브셋 폰트 커버리지 (여기 없는 한국어 글자는 tofu 위험 → 빌드 실패로 조기 발견)
const METRICS = JSON.parse(readFileSync(join(root, 'scripts/metrics.json'), 'utf8'));
function assertCovered(str, where) {
  for (const ch of str) {
    if (ch.charCodeAt(0) > 127 && !(ch in METRICS)) {
      throw new Error(`서브셋 폰트에 없는 글자 "${ch}" (${where}) — scripts/copy.mjs GLYPH_BUDGET에 추가 후 서브셋 재생성 필요`);
    }
  }
  return str;
}

// ------------------------------------------------------------
// 1) 데이터 수집
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
  const thisYearFrom = `${year}-01-01T00:00:00Z`;
  const lastYearFrom = `${year - 1}-01-01T00:00:00Z`;
  const lastYearTo = `${year - 1}-12-31T23:59:59Z`;
  const oneYearAgo = new Date(now.getTime() - 364 * 86400 * 1000).toISOString();

  const q = `
query($login: String!, $thisFrom: DateTime!, $lastFrom: DateTime!, $lastTo: DateTime!, $rollFrom: DateTime!) {
  user(login: $login) {
    createdAt
    thisYear: contributionsCollection(from: $thisFrom) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      contributionCalendar { totalContributions }
    }
    lastYear: contributionsCollection(from: $lastFrom, to: $lastTo) {
      contributionCalendar { totalContributions }
    }
    rolling: contributionsCollection(from: $rollFrom) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 6, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name } }
        }
      }
    }
  }
}`;
  const d = await gql(q, {
    login: LOGIN, thisFrom: thisYearFrom, lastFrom: lastYearFrom, lastTo: lastYearTo, rollFrom: oneYearAgo,
  });
  const u = d.user;

  // 스트릭 계산 (KST 기준 날짜 문자열 비교)
  const days = u.rolling.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  days.sort((a, b) => a.date.localeCompare(b.date));
  const todayStr = kst.toISOString().slice(0, 10);
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.date > todayStr) continue;
    run = day.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // current streak: 오늘(기여 0이면 어제)부터 거꾸로
  const past = days.filter((day) => day.date <= todayStr);
  let idx = past.length - 1;
  if (idx >= 0 && past[idx].contributionCount === 0) idx--; // 오늘 아직 커밋 전이면 어제부터
  for (; idx >= 0 && past[idx].contributionCount > 0; idx--) current++;

  // 언어 집계 (바이트 기준, ownerAffiliations OWNER + non-fork)
  const LANG_EXCLUDE = new Set(['PLpgSQL', 'Roff', 'Makefile', 'Dockerfile', 'Batchfile', 'CMake', 'Jupyter Notebook']);
  const langBytes = new Map();
  for (const repo of u.repositories.nodes) {
    for (const e of repo.languages.edges) {
      if (LANG_EXCLUDE.has(e.node.name)) continue;
      langBytes.set(e.node.name, (langBytes.get(e.node.name) ?? 0) + e.size);
    }
  }
  const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1;
  const langs = [...langBytes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, bytes]) => ({ name, pct: (bytes / totalBytes) * 100 }));

  return {
    year,
    todayStr,
    level: year - FIRST_YEAR + 1,
    thisYearTotal: u.thisYear.contributionCalendar.totalContributions,
    lastYearTotal: u.lastYear.contributionCalendar.totalContributions,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    repos: u.repositories.totalCount,
    followers: u.followers.totalCount,
    streak: current,
    longestStreak: longest,
    langs,
  };
}

// ------------------------------------------------------------
// 2) 렌더
// ------------------------------------------------------------
const fmt = (n) => n.toLocaleString('en-US');

const MINI_ICONS = {
  commit: ['..#..', '.###.', '#####', '.###.', '..#..'],
  star: FONT5['★'],
  pr: ['##.##', '##.##', '.....', '##.##', '##.##'],
  issue: ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  flame0: ['..#..', '.##..', '.###.', '#####', '.###.'],
  flame1: ['...#.', '..##.', '.###.', '#####', '.###.'],
};

function hud(t, s) {
  const W = 1000;
  const H = 430;
  const dark = t.id === 'dark';
  const P = 30; // 좌우 패딩

  // ---- LV + EXP (작년 총 기여 돌파 진행률)
  const target = Math.max(s.lastYearTotal, 1);
  const ratio = Math.min(s.thisYearTotal / target, 1);
  const beaten = s.thisYearTotal >= s.lastYearTotal && s.lastYearTotal > 0;
  const lvText = `LV.${s.level}`;
  const lvW = pixelTextWidth(lvText, 6, 1);
  const expLabel = `EXP ${fmt(s.thisYearTotal)} / ${fmt(target)}`;
  const expX = P + lvW + 34;
  const expBarW = W - expX - P - 90;
  const expY = 58;
  const fillW = Math.round(expBarW * ratio);
  const pctText = beaten ? 'MAX!' : `${Math.round(ratio * 100)}%`;
  const expKr = assertCovered(
    beaten ? `${s.year - 1}년 기록 돌파! 신기록 진행중` : `${s.year - 1}년 기록 돌파까지`,
    'exp',
  );

  const expBlock = `
${pixelText(lvText, { x: P, y: 34, cell: 6, fill: t.neon })}
${pixelText('ORI / LEE YOUNGJAE', { x: P + 2, y: 88, cell: 2, fill: t.muted })}
${pixelText(expLabel, { x: expX, y: 32, cell: 2.4, fill: t.ink })}
<text x="${expX + expBarW}" y="46" text-anchor="end" font-family=${JSON.stringify(KFONT)} font-size="11" fill="${t.muted}">${esc(expKr)}</text>
<rect x="${expX}" y="${expY}" width="${expBarW}" height="20" fill="${t.well}"/>
<rect x="${expX}" y="${expY}" width="${expBarW}" height="20" fill="none" stroke="${t.bezelHi}" stroke-width="2"/>
<g clip-path="url(#expClip)">
  <rect class="expfill" x="${expX + 2}" y="${expY + 2}" width="${Math.max(fillW - 4, 2)}" height="16" fill="${t.data.green}"/>
  <rect class="expfill" x="${expX + 2}" y="${expY + 2}" width="${Math.max(fillW - 4, 2)}" height="5" fill="#ffffff" opacity="${dark ? 0.18 : 0.28}"/>
  <rect class="shine" x="${expX - 40}" y="${expY}" width="26" height="20" fill="#ffffff" opacity="0.22"/>
</g>
${pixelText(pctText, { x: expX + expBarW + 12, y: expY + 2, cell: 2.4, fill: beaten ? t.neonAmber : t.ink })}
<clipPath id="expClip"><rect x="${expX + 2}" y="${expY}" width="${Math.max(fillW - 4, 2)}" height="20"/></clipPath>
`;

  // ---- 스탯 타일 5개
  const tiles = [
    { label: `CONTRIB ${s.year}`, value: fmt(s.thisYearTotal), icon: 'commit', hue: t.data.cyan },
    { label: 'STREAK', value: `${s.streak}D`, icon: 'flame', hue: t.data.green },
    { label: 'BEST STREAK', value: `${s.longestStreak}D`, icon: 'flame', hue: t.data.magenta },
    { label: 'REPOS', value: fmt(s.repos), icon: 'pr', hue: t.data.violet },
    { label: 'STARS', value: fmt(s.stars), icon: 'star', hue: t.data.amber },
  ];
  const tileY = 118;
  const tileH = 84;
  const tileGap = 12;
  const tileW = (W - P * 2 - tileGap * 4) / 5; // 5개
  const tileSvg = tiles.map((tile, i) => {
    const x = P + i * (tileW + tileGap);
    const icon = tile.icon === 'flame'
      ? `<g class="fl0">${bitmapRects(MINI_ICONS.flame0, { x: x + 16, y: tileY + 16, cell: 3, fill: tile.hue })}</g>
         <g class="fl1">${bitmapRects(MINI_ICONS.flame1, { x: x + 16, y: tileY + 16, cell: 3, fill: tile.hue })}</g>`
      : bitmapRects(MINI_ICONS[tile.icon], { x: x + 16, y: tileY + 16, cell: 3, fill: tile.hue });
    return `
<path d="${pixelFrame(x, tileY, tileW, tileH, 8)}" fill="${dark ? '#0c1220' : '#faf3e3'}"/>
<path d="${pixelFrame(x, tileY, tileW, tileH, 8)}" fill="none" stroke="${t.bezelHi}" stroke-width="2"/>
<rect x="${x + 10}" y="${tileY + 2}" width="${tileW - 20}" height="4" fill="${tile.hue}" opacity="0.9"/>
${icon}
${pixelText(tile.label, { x: x + 40, y: tileY + 18, cell: 1.8, fill: t.muted })}
${pixelText(tile.value, { x: x + 16, y: tileY + 44, cell: 3.6, fill: t.ink })}
`;
  }).join('');

  // ---- 언어 게이지 (top 5, entity-fixed hue + 직접 라벨)
  const langY = 236;
  const rowH = 26;
  const labelW = 150;
  const pctW = 64;
  const barX = P + labelW;
  const barW = W - barX - P - pctW;
  const usedHues = new Set();
  const hueOf = (name) => {
    let hue = LANG_HUES[name];
    if (!hue || usedHues.has(hue)) hue = HUE_FALLBACK.find((h) => !usedHues.has(h)) ?? 'cyan';
    usedHues.add(hue);
    return t.data[hue];
  };
  const maxPct = Math.max(...s.langs.map((l) => l.pct), 1);
  const langRows = s.langs.map((l, i) => {
    const y = langY + 30 + i * rowH;
    const w = Math.max(Math.round((l.pct / maxPct) * barW), 4);
    const color = hueOf(l.name);
    return `
${pixelText(l.name.toUpperCase().slice(0, 12), { x: P, y: y + 1, cell: 1.8, fill: t.ink })}
<rect x="${barX}" y="${y}" width="${barW}" height="12" fill="${t.well}"/>
<rect class="lang lang${i}" x="${barX}" y="${y}" width="${w}" height="12" fill="${color}"/>
<rect x="${barX + 2}" y="${y + 2}" width="${Math.max(w - 4, 1)}" height="3" fill="#ffffff" opacity="${dark ? 0.15 : 0.25}" class="lang lang${i}"/>
${pixelText(`${l.pct.toFixed(1)}%`, { x: barX + barW + 12, y: y + 1, cell: 1.8, fill: t.muted })}
`;
  }).join('');

  // ---- 상태 멘트 (데이터 반응형 유머)
  const mood = assertCovered(
    s.streak === 0
      ? '상태이상: 리스폰 대기중... 곧 복귀합니다'
      : s.streak >= 14
        ? `버프 발동: ${s.streak}일 연속 출석 — 개발 의욕 +${Math.min(s.streak, 99)}%`
        : '상태: 오늘도 정상 영업중',
    'mood',
  );

  const style = `
${fontFaceCSS()}
.shine{animation:shine 3.2s ease-in-out 1.2s infinite}
@keyframes shine{0%{transform:translateX(0)}55%,100%{transform:translateX(${expBarW + 80}px)}}
.expfill{transform-origin:${expX + 2}px 0;animation:grow .9s cubic-bezier(.2,.7,.2,1) both}
${s.langs.map((_, i) => `.lang${i}{transform-origin:${barX}px 0;animation:grow .8s cubic-bezier(.2,.7,.2,1) ${(0.15 + i * 0.12).toFixed(2)}s both}`).join('')}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.fl0{animation:f0 .5s steps(1,end) infinite}
.fl1{animation:f1 .5s steps(1,end) infinite}
@keyframes f0{0%,100%{opacity:1}50%{opacity:0}}
@keyframes f1{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
`;

  const body = `
<path d="${pixelFrame(1, 1, W - 2, H - 2, 12)}" fill="${t.card}"/>
<path d="${pixelFrame(1, 1, W - 2, H - 2, 12)}" fill="none" stroke="${t.bezelHi}" stroke-width="2.5"/>
${expBlock}
${tileSvg}
${pixelText('LANGUAGE GAUGE', { x: P, y: langY, cell: 2.2, fill: t.muted })}
<rect x="${P + pixelTextWidth('LANGUAGE GAUGE', 2.2, 1) + 14}" y="${langY + 6}" width="${W - P * 2 - pixelTextWidth('LANGUAGE GAUGE', 2.2, 1) - 14}" height="2" fill="${t.bezel}"/>
${langRows}
<text x="${P}" y="${H - 22}" font-family=${JSON.stringify(KFONT)} font-size="12" fill="${t.muted}">${esc(mood)}</text>
<text x="${W - P}" y="${H - 22}" text-anchor="end" font-family=${JSON.stringify(KFONT)} font-size="11" fill="${t.faint}">LAST SYNC ${s.todayStr} · ${esc(assertCovered(COPY.status.caption, 'caption'))}</text>
`;

  return svgDoc({
    w: W, h: H,
    title: `STATUS — LV.${s.level}, ${s.year} 기여 ${s.thisYearTotal}`,
    desc: `기여 ${s.thisYearTotal}, 스트릭 ${s.streak}일(최장 ${s.longestStreak}일), 레포 ${s.repos}, 별 ${s.stars}`,
    style, body,
  });
}

// ------------------------------------------------------------
const stats = await fetchStats();
console.log('stats:', JSON.stringify(stats, null, 2));
for (const t of Object.values(THEMES)) {
  const svg = hud(t, stats);
  writeFileSync(join(root, `assets/hud-${t.id}.svg`), svg);
  console.log(`✔ assets/hud-${t.id}.svg`, (svg.length / 1024).toFixed(1) + 'KB');
}
