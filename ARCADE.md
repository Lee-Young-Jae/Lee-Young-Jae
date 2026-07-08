# 🕹️ ORI ARCADE — 운영 가이드

이 저장소의 프로필은 전부 **코드로 그린 SVG**입니다. 손으로 만지는 파일은 `scripts/` 뿐이고,
`assets/*.svg` 는 전부 산출물입니다 (직접 수정 금지 — 다음 빌드에서 덮어써짐).

## 구조

```
scripts/
  theme.mjs        디자인 토큰 · 5×7 픽셀 폰트 · 오리 스프라이트 · SVG 헬퍼
  copy.mjs         한국어 카피 전부 (폰트 서브셋의 기준!)
  fonts.mjs        Galmuri 서브셋 base64 임베드 + 글리프 폭 측정
  metrics.json     서브셋 글리프별 폭 (hmtx에서 추출한 산출물)
  build-assets.mjs 정적 SVG 전부 (히어로/버튼/배너/장비창/푸터)
  render-hud.mjs   동적 상태창 (GitHub GraphQL → hud-*.svg)
assets/            산출물 (SVG + 서브셋 폰트)
.github/workflows/
  arcade-hud.yml   매일 03:10 KST 상태창 재렌더 + 커밋
  pacman.yml       매일 03:30 KST 팩맨 그래프 → output 브랜치
```

## 자주 하는 일

```bash
npm run build                              # 정적 어셋 리빌드
GITHUB_TOKEN=$(gh auth token) npm run hud  # 상태창 로컬 갱신
```

### 카피(문구) 수정

1. `scripts/copy.mjs` 의 `COPY` 수정 — **새 한국어 글자**를 썼다면 폰트 서브셋도 다시:
2. ```bash
   python3 -m venv .venv && .venv/bin/pip install fonttools brotli
   node -e "import('./scripts/copy.mjs').then(m=>process.stdout.write(m.collectGlyphs()))" > /tmp/glyphs.txt
   .venv/bin/pyftsubset <Galmuri11.woff2 원본> --text-file=/tmp/glyphs.txt --flavor=woff2 \
     --output-file=assets/fonts/Galmuri11.subset.woff2 --layout-features='*' --no-hinting
   # Bold도 동일하게. 원본: https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/
   ```
3. 메트릭 재추출(폭 계산용) 후 빌드:
   `fontTools`로 `scripts/metrics.json` 재생성 → `npm run build`
   (자주 안 바꾸면 GLYPH_BUDGET에 이미 흔한 글자가 들어있어 대부분 서브셋 재생성 없이 통과)

> `render-hud.mjs` 는 서브셋에 없는 한국어 글자를 쓰면 **빌드를 실패**시켜 tofu를 조기에 잡습니다.

## 시크릿 (선택)

| 시크릿 | 용도 |
|---|---|
| `HUD_TOKEN` | `read:user` 스코프 PAT. 등록하면 상태창 수치에 **비공개 기여까지** 집계됩니다. 없으면 기본 `GITHUB_TOKEN`(공개 기여만)으로 동작. |

## 팔레트 규칙

데이터 마크(언어 게이지, EXP 바)는 검증 통과 팔레트만 사용:

- dark(`#0a0f18` 표면): `#2e9ad8` `#c98500` `#e0447e` `#1e9a58` `#9d71f2` — all-pairs 최악 ΔE 13.0, 전 항목 PASS
- light(`#f4eee0` 표면): `#0f7fa8` `#a86a00` `#c9366d` `#0f7d4d` `#7d4fc9` — 전 항목 PASS

네온(`neon*` 토큰)은 장식 전용입니다. 데이터에 쓰지 마세요.
언어→색은 `LANG_HUES` 로 **엔티티 고정** (순위가 바뀌어도 색은 언어를 따라감).

## 폰트 라이선스

[Galmuri](https://github.com/quiple/galmuri) (Lee Minseo) — SIL OFL 1.1.
서브셋 재배포 고지: `assets/fonts/LICENSE-Galmuri.md`
