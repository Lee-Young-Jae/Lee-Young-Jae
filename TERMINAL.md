# ori terminal — 운영 가이드

프로필의 모든 SVG는 **코드로 그려진 산출물**입니다. 손대는 파일은 `scripts/` 뿐이고
`assets/*.svg` 는 빌드 결과물입니다 (직접 수정 금지 — 다음 빌드가 덮어씀).

> 이전 컨셉(픽셀 아케이드)은 `archive/arcade-concept` 브랜치에 통째로 보존되어 있습니다.

## 구조

```
scripts/
  theme.mjs         ORI NIGHT/PAPER 토큰 · 윈도우 크롬 · 타이핑 연출 엔진
  copy.mjs          세션 시나리오(한국어 카피 전부 — 폰트 서브셋의 기준!)
  fonts.mjs         D2Coding 서브셋 base64 임베드 + 커버리지 가드/새니타이저
  metrics.json      서브셋 글리프 폭 (hmtx 산출물)
  build-assets.mjs  정적 SVG (hero=0:fetch / sea=3:sea 수족관 / footer / 버튼)
  render-stats.mjs  동적 SVG (stats=1:stats 히트맵·게이지, repos=2:repos 최근 레포)
assets/             산출물 (SVG + 서브셋 폰트 + OFL 고지)
.github/workflows/stats.yml   매일 03:10 KST stats+repos 재렌더 + 커밋
```

터미널 창들은 같은 tmux 세션 `[ori]`의 0:fetch / 1:stats / 2:repos / 3:sea 창입니다.

### 특정 레포 숨기기 (2:repos 창)

`scripts/copy.mjs` → `COPY.repos.hide` 배열에 레포 이름을 추가하면 다음 갱신부터 빠집니다.
기본 필터: 공개(non-fork, 비아카이브) + **설명(description) 있는** 레포만, 최근 푸시 순 5개.
설명의 미커버 글자·이모지는 조용히 제거되고(sanitizeCovered), 긴 설명은 `…`로 잘립니다.

## 자주 하는 일

```bash
npm run build                               # 정적 어셋 리빌드
GITHUB_TOKEN=$(gh auth token) npm run stats # stats 창 로컬 갱신
```

### 카피(문구) 수정

`scripts/copy.mjs` 수정 → `npm run build`.
**새 한국어 글자**를 썼는데 서브셋에 없으면 빌드가 에러로 알려줍니다. 그 경우:

```bash
python3 -m venv .venv && .venv/bin/pip install fonttools brotli
node -e "import('./scripts/copy.mjs').then(m=>process.stdout.write(m.collectGlyphs()))" > /tmp/glyphs.txt
# 원본: npm의 d2coding@1.3.2 패키지 fonts/d2coding-full.ttf (Bold 동일)
.venv/bin/pyftsubset d2coding-full.ttf --text-file=/tmp/glyphs.txt --flavor=woff2 \
  --output-file=assets/fonts/D2Coding.subset.woff2 --layout-features='*' --no-hinting
# metrics.json 재추출(fontTools cmap+hmtx) 후 npm run build
```

## 시크릿 (선택)

| 시크릿 | 용도 |
|---|---|
| `HUD_TOKEN` | `read:user` PAT. 등록하면 stats에 **비공개 기여까지** 집계. 없으면 공개 기여 기준. |

## 팔레트 규칙 (dataviz validator 통과값)

- 카테고리(언어 게이지) dark on `#0a0e17`: `#2e9ad8` `#c98500` `#e0447e` `#1e9a58` `#9d71f2` — 전 항목 PASS
- 카테고리 light on `#f1ece0`: `#0f7fa8` `#a86a00` `#c9366d` `#0f7d4d` `#7d4fc9` — 전 항목 PASS
- 히트맵 램프 dark: `#1d5a34→#a0f2c3`, light: `#6fb28c→#0a4d31` — ordinal 전 항목 PASS
- ANSI 색(`green/cyan/...`)은 신택스/장식 전용. 데이터 마크에 쓰지 않기.
- 언어→색은 `LANG_HUES`로 엔티티 고정.

## 폰트 라이선스

[D2Coding](https://github.com/naver/d2codingfont) (NAVER) — SIL OFL 1.1.
서브셋 재배포 고지: `assets/fonts/LICENSE-D2Coding.md`
