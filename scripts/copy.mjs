// ============================================================
//  터미널 세션 시나리오 — 한국어 텍스트는 전부 여기에.
//  (폰트 서브셋이 이 파일 기준으로 생성됨: 새 한국어 글자 추가 시 npm run subset)
// ============================================================

export const COPY = {
  session: 'ori',
  host: 'github.com/Lee-Young-Jae',

  fetch: {
    cmd: 'ori-fetch',
    rows: [
      ['이름', '이영재 Lee YoungJae'],
      ['직업', 'Frontend Developer'],
      ['주력', 'React · Next.js · TypeScript'],
      ['보조', 'NestJS · Flutter · Claude Code'],
      ['가동시간', '2021년 첫 커밋부터 계속'],
      ['상태', '재미있는 걸 만드는 중'],
    ],
  },

  about: {
    cmd: 'cat about.md',
    lines: [
      { type: 'h', text: '# 안녕하세요, 이영재입니다.' },
      { type: 'p', text: '"돌아간다"와 "잘 만들었다" 사이의 간격을 좁히는 게 일입니다.' },
      { type: 'p', text: '요즘은 웹뷰 진단 도구와 에이전트 하네스를 만들고 있습니다.' },
    ],
  },

  stats: {
    cmd: 'ori stats',
    heatmapTitle: '기여 히트맵 · 최근 52주',
    expLabelFmt: (year, prev) => `${prev}년 기록 대비`,
    rows: {
      contrib: '올해 기여',
      streak: '스트릭',
      streakFmt: (cur, best) => `${cur}일 연속 · 최장 ${best}일`,
      meta: '컬렉션',
      metaFmt: (repos, stars, followers) => `레포 ${repos} · 스타 ${stars} · 팔로워 ${followers}`,
      langs: '언어',
    },
    footerFmt: (date) => `last sync ${date} KST · GitHub Actions가 매일 밤 갱신`,
    moods: {
      zero: '# 오늘은 잔디에 물 주는 날',
      normal: '# 오늘도 정상 영업중',
      hot: (d) => `# ${d}일 연속 출석 — 궤도에 올랐습니다`,
    },
  },

  repos: {
    cmd: 'ori repos --recent',
    // 노출하고 싶지 않은 레포는 여기에 이름 추가 (다음 갱신 때 사라짐)
    hide: [],
    max: 5,
    footer: '# 최근 푸시 순 상위 5개 · 매일 밤 자동 갱신',
    empty: '# 요즘은 조용히 갈고닦는 중',
    ago: { today: '오늘', days: (n) => `${n}일 전`, weeks: (n) => `${n}주 전`, months: (n) => `${n}개월 전` },
  },

  party: {
    cmd: 'ori quack --max',
    quack: '꽥',
    outroFmt: (date) => `# 이 세션은 GitHub Actions가 매일 밤 다시 녹화합니다 · last sync ${date} KST`,
  },

  buttons: {
    portfolio: { cmd: 'open portfolio', kr: '포트폴리오' },
    blog: { cmd: 'open blog', kr: '개발 블로그' },
    mail: { cmd: 'mail ori', kr: '이메일' },
  },

  bar: {
    session: '[ori]',
    rec: '● REC',
  },
};

// 서브셋 여유분 (카피 수정 대비 흔한 글자 버퍼 + 레포 설명에서 관측된 글자)
export const GLYPH_BUDGET = `
훅됨줘봄윙퀄릴엔젤캣헙깃

가각간갈감갑값강같개객갤거건걷걸검겁것게겨격겪견결경계고곡곤곧골곰곱곳공과관광괜교구국군굳굴굵궁권귀규균그극근글금급긋긍기긴길김깁깃깊까깎깐깔깜깝깥깨꺼꺾껍껏께껴꼬꼭꼴꼼꼽꽂꽃꽉꽤꾸꾼꿀꿈뀌끄끈끊끌끓끔끝끼낌나낙난날낡남납낫낭낮낯낱낳내냄냉냐너넉널넓넘넣네넷녀녁년념녕노녹논놀놈농높놓놔뇌뇨누눈눕뉘뉴늄느늑는늘늙능늦늬니닉닌닐님다닥닦단닫달닭닮담답닷당닿대댁댐더덕던덜덤덥덧덩덮데델도독돈돌돕동돼되된두둑둘둠둡둥뒤뒷드득든듣들듬듭듯등디딩딪따딱딴딸땀땅때땜떠떡떤떨떻떼또똑뚜뚫뚱뛰뜨뜩뜯뜰뜻띄라락란람랍랑랗래랙랜램랫략량러럭런럴럼럽럿렁렇레렉렌려력련렬렵령례로록론롬롭롯료루룩룹룻뤄류륙률륭르른름릇릎리릭린림립릿링마막만많말맑맘맙맛망맞맡맣매맥맨맵맺머먹먼멀멈멋멍멎메멘멜며면멸명몇모목몰몸몹못몽묘무묵묶문묻물뭄뭇뭐뭘뮤므미민믿밀밉밌및밑바박밖반받발밝밟밤밥방밭배백뱀뱃뱉버번벌범법벗베벤벨벼벽변별볍병볕보복볶본볼봄봇봉뵈뵙부북분불붉붐붓붕붙뷰브븐블비빌빔빗빚빛빠빡빨빵빼뺏뺨뻐뻔뻗뼈뽀뽑뿌뿐쁘쁨사삭산살삶삼삿상새색샌생샤서석섞선설섬섭섯성세섹센셈셋셔션소속손솔솜솟송솥쇄쇠쇼수숙순숟술숨숫숲쉬쉰쉽슈스슨슬슴습슷승시식신싣실싫심십싱싶싸싹싼쌀쌍쌓써썩썰썹쎄쏘쏟쑤쓰쓴쓸씀씌씨씩씬씹씻아악안앉않알앓암압앗앙앞애액앨야약얀얄얇양얕얗얘어억언얹얻얼엄업없엇엉엌엎에엔엘여역연열엷염엽엿영옆예옛오옥온올옮옳옷옹와완왕왜왠외왼요욕용우욱운울움웃웅워원월웨웬위윗유육율으윽은을음응의이익인일읽잃임입잇있잊잎자작잔잖잘잠잡장잦재쟁저적전절젊점접젓정젖제젠젯져조족존졸좀좁종좋좌죄주죽준줄줌줍중쥐즈즉즌즐즘즙증지직진질짐집짓징짙짚짜짝짧째쨌쩌쩍쩐쩔쩜쪽쫓쭈쭉찌찍찢차착찬찮찰참찻창찾채책챔챙처척천철첩첫청체쳐초촉촌촛총촬최추축춘출춤춥춧충취츠측츰층치칙친칠침칫칭카칸칼캄캐캠커컨컬컴컵컷케켓켜코콘콜콤콩쾌쿄쿠퀴크큰클큼키킬타탁탄탈탑탓탕태택탤터턱턴털텅테텍텔템토톤톨톱통퇴투툴툼퉁튀튜트특튼튿틀틈티틱팀팅파팎판팔팜패팩팬퍼퍽페펜펴편펼평폐포폭폰표푸푹풀품풍퓨프플픔피픽필핏핑하학한할함합항해핵핸햄햇행향허헌험헤헬혀현혈협형혜호혹혼홀홈홉홍화확환활황회획횟횡효후훈훌훔훨휘휴흉흐흑흔흘흙흡흥흩희흰히힘
`;

export function collectGlyphs() {
  const walk = (v) =>
    typeof v === 'string' ? v
      : typeof v === 'function' ? walk(v('9999', '9999', '9999'))
        : Array.isArray(v) ? v.map(walk).join('')
          : v && typeof v === 'object' ? Object.values(v).map(walk).join('')
            : '';
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
  const box = '─│┌┐└┘├┤┬┴┼╭╮╰╯━┃█▉▊▋▌▍▎▏▁▂▃▄▅▆▇▰▱░▒▓●○◆◇▲△❯↗·—…✓✗×※';
  const all = walk(COPY) + GLYPH_BUDGET + ascii + box;
  return [...new Set([...all.replace(/[\n\r\t]/g, '')])].join('') + ' ';
}
