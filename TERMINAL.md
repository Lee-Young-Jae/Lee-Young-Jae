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
  build-assets.mjs  정적 SVG (링크 버튼 4종)
  render-stats.mjs  세션 SVG 전체 (session-{dark,light}.svg 하나에 모든 장면)
assets/             산출물 (SVG + 서브셋 폰트 + OFL 고지)
.github/workflows/stats.yml   매일 03:10 KST 세션 재녹화 + 커밋
```

프로필은 **터미널 하나**로 구성됩니다 — `ori-fetch`(오리 13초 서사: 깜빡·꽥·몸을 기울여 물속으로 자맥질·날갯짓, 사인 물결 2겹 + 필터로 일렁이는 수면 반영, 정보 행 해독 연출)
→ `cat about.md` → `ori ps`(서비스 중인 개인 앱 — 심박 점 + 심전도) → `ori stats`(**플로팅 아이소메트릭 다이오라마**: 두 축 기울인 3D 잔디 기둥 + 슬래브 + 그림자,
둘레에 해안 거품과 `~` 물결, 1년 타임랩스, 오리가 앞바다를 지날 때 주 단위로 출렁, 기여 수는 오도미터로 굴러 올라옴) → `ori repos --recent` → `ori quack --max`(픽셀 QUACK! + EQ + 색종이 + 군무).
하단 상태바에는 ● REC 점멸, 페이지를 연 뒤 흐른 시간을 세는 타임코드(CSS steps), 산책하는 미니 오리.
작년 기록을 넘기면 기여 막대 끝에서 불꽃이 튑니다.

세션 전체 배속은 `render-stats.mjs`의 `SPEED`, 서비스 목록은 `COPY.apps.items`에서 바꿉니다.

**40초 마스터 주기** (`render-stats.mjs`의 `M`): 오리 한 마리가 연못에서 잠수해 화면 아래로 떨어지고 → 섬 앞바다에 착수해 가로지른 뒤 →
포물선으로 뛰어 QUACK 무대에서 춤추다 → 연못으로 돌아옵니다. 같은 주기로 섬은 1년 타임랩스를 반복합니다(주 단위로 솟고, 제목 줄 오른쪽에 연-월 표시).
시각은 `T_DIVE`·`T_SPLASH`·`T_BACK` 등 상수로 조정합니다.
비구름은 타임랩스 앞머리를 따라가며 비를 뿌리고(구름·비·그림자가 한 몸으로 이동), 스트릭이 0인 날엔 최근 주 위에 남아 새싹을 틔웁니다.
주기 막바지(`STORM_T`)에는 섬 전체에 소나기와 번개(`BOLTS`)가 지나가고, 직후 섬이 가라앉아 다시 자랍니다.

그 밖의 연출: 시작할 때 브라운관이 켜지듯 화면이 펼쳐지고, 소개 글 한 줄이 드래그 선택되듯 하이라이트되며,
언어 막대에는 빛줄기와 굴러 올라오는 퍼센트, 레포 목록에는 별표를 잇는 git 그래프 선이 그려집니다.

### 특정 레포 숨기기 (2:repos 창)

`scripts/copy.mjs` → `COPY.repos.hide` 배열에 레포 이름을 추가하면 다음 갱신부터 빠집니다.
기본 필터: non-fork·비아카이브, 최근 푸시 순 5개. 비공개 레포(이름 모자이크)는 `COPY.repos.maxPrivate`개(기본 1)까지만 들어가고 나머지는 공개 레포로 채웁니다.
설명의 미커버 글자·이모지는 조용히 제거되고(sanitizeCovered), 긴 설명은 `…`로 잘립니다.

### stats 표시 규칙

- 언어 게이지는 HTML을 제외하고 집계합니다 (생성 산출물이 실제 작업 언어를 가려서).
- 스트릭이 0이면 "0일 연속" 없이 최장 기록만 보여줍니다.
- 스타·팔로워는 `COPY.stats.rows.metaMin`(스타 10, 팔로워 50)을 넘었을 때만 컬렉션 줄에 나옵니다.

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
