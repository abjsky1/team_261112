// =========================================================
// Diamond AI · 화면 스크립트
// =========================================================

// ===== 서버 주소 =====
// - http://127.0.0.1:8000 으로 접속 (AppStart 가 화면 제공) → 같은 서버이므로 상대경로('')
// - HTML 파일 직접 열기 / Live Server 등 다른 주소 → 8000번 FastAPI 서버로 요청 (AppStart 에서 CORS 허용)
const API_BASE = location.port === '8000' ? '' : 'http://127.0.0.1:8000';

// 모델 성능 지표 : abj-01.py 실행 결과(print) 값 (테스트 데이터 기준)
const METRICS = {
  r2: 0.9207,
  rmse: 1109.04,
  mae: 727.83,
  test_count: 10787,
  model: 'Ridge(alpha=10.0)',
};

// 데이터셋 가격 분포 (0%, 5%, 10% … 100% 백분위수) → 예측 가격이 "상위 몇 %" 인지 계산용
const PRICE_PCT = [326, 544, 646, 737, 837, 950, 1087, 1334, 1698, 2011, 2401,
  2863, 3465, 4116, 4662, 5324, 6301, 7666, 9820, 13103, 18823];
const AVG_PRICE = 3932.14;

// 예시값 : 테스트 데이터에서 무작위로 뽑은 실제 다이아몬드 (price = 실제 가격)
const EXAMPLES = [
  { carat: 0.43, cut: 'Good',      color: 'F', clarity: 'VS1', depth: 57.9, table: 61, x: 4.99, y: 5.03, price: 931 },
  { carat: 0.71, cut: 'Premium',   color: 'D', clarity: 'VS2', depth: 62.7, table: 58, x: 5.53, y: 5.67, price: 2659 },
  { carat: 1.02, cut: 'Ideal',     color: 'F', clarity: 'I1',  depth: 61.0, table: 56, x: 6.53, y: 6.51, price: 3599 },
  { carat: 1.52, cut: 'Very Good', color: 'D', clarity: 'SI2', depth: 58.6, table: 59, x: 7.43, y: 7.48, price: 9817 },
];

// 등급 순서 (낮음 → 높음) 와 한글 설명
const CUTS = ['Fair', 'Good', 'Very Good', 'Premium', 'Ideal'];
const COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J'];                    // D 가 최고(무색)
const CLARITIES = ['I1', 'SI2', 'SI1', 'VS2', 'VS1', 'VVS2', 'VVS1', 'IF'];
const CUT_KO = { Fair: '보통', Good: '양호', 'Very Good': '우수', Premium: '프리미엄', Ideal: '최상' };
const COLOR_KO = { D: '완전 무색', E: '무색', F: '무색', G: '거의 무색', H: '거의 무색', I: '옅은 빛', J: '옅은 노란빛' };
const CLARITY_KO = {
  I1: '내포물 뚜렷', SI2: '내포물 약간', SI1: '내포물 약간', VS2: '아주 미세',
  VS1: '아주 미세', VVS2: '극히 미세', VVS1: '극히 미세', IF: '내부 무결점',
};

// ===== 화면 요소 =====
const $ = (id) => document.getElementById(id);
const form = $('predictForm');
const caratRange = $('caratRange');
const caratInput = $('carat');
const submitBtn = $('submitBtn');
const panel = $('resultCard');
const stage = $('stage');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('ko-KR');

let exampleIndex = 0;
let activeExample = null;   // 예시값을 채운 뒤 수정하지 않았으면 실제 가격 비교 표시
let lastPrice = 0;          // 숫자 애니메이션 시작값
let priceAnimId = 0;
let hasResult = false;
let prevGem = null;         // 직전 다이아몬드 상태 (무엇이 바뀌었는지 비교)

const DEFAULT_SUB = '왼쪽에 정보를 입력하고 <b>AI 감정 시작</b>을 눌러주세요.';

// =========================================================
// 1. 다이아몬드 그리기 (SVG 면 생성)
// =========================================================
function buildGem() {
  const NS = 'http://www.w3.org/2000/svg';
  const T = [[50, 24], [83, 24], [117, 24], [150, 24]];                  // 윗면(테이블)
  const G = [[8, 64], [54, 64], [100, 64], [146, 64], [192, 64]];        // 거들(가장 넓은 부분)
  const P = Array.from({ length: 9 }, (_, i) => [8 + i * 23, 64]);       // 아랫면 시작점
  const B = [100, 176];                                                   // 뾰족한 끝

  const crown = [
    [G[0], T[0], G[1]], [T[0], T[1], G[1]], [T[1], G[2], G[1]], [T[1], T[2], G[2]],
    [T[2], G[3], G[2]], [T[2], T[3], G[3]], [T[3], G[4], G[3]],
  ];
  const pavilion = P.slice(0, 8).map((p, i) => [p, P[i + 1], B]);
  const fills = ['gB', 'gA', 'gC', 'gA', 'gB', 'gA', 'gC', 'gC', 'gA', 'gB', 'gA', 'gC', 'gB', 'gA', 'gC'];

  [...crown, ...pavilion].forEach((pts, i) => {
    const points = pts.map((p) => p.join(',')).join(' ');

    const facet = document.createElementNS(NS, 'polygon');
    facet.setAttribute('points', points);
    facet.setAttribute('class', 'facet');
    facet.setAttribute('fill', `url(#${fills[i]})`);
    $('facets').appendChild(facet);

    // 면마다 시간차로 번쩍 → 회전하며 반짝이는 느낌
    const flash = document.createElementNS(NS, 'polygon');
    flash.setAttribute('points', points);
    flash.setAttribute('class', 'flash');
    const delay = i < 7 ? i * 0.32 : (i - 7) * 0.28 + 0.16;
    flash.style.animationDelay = `${delay}s`;
    $('flashes').appendChild(flash);
  });
}

// =========================================================
// 2. 입력값 → 다이아몬드 모습 (크기 / 광채 / 색 / 선명도)
// =========================================================
function readGem() {
  const d = getFormData();
  const carat = Number.isFinite(d.carat) && d.carat > 0 ? d.carat : 0.7;
  return {
    carat,
    cut: d.cut,
    color: d.color,
    clarity: d.clarity,
    size: Math.sqrt((Math.min(Math.max(carat, 0.2), 3) - 0.2) / 2.8),   // 0 ~ 1
    cutF: CUTS.indexOf(d.cut) / (CUTS.length - 1),                       // 0 ~ 1 (Ideal = 1)
    colorF: COLORS.indexOf(d.color) / (COLORS.length - 1),               // 0 ~ 1 (D = 0, J = 1)
    clarityF: CLARITIES.indexOf(d.clarity) / (CLARITIES.length - 1),     // 0 ~ 1 (IF = 1)
  };
}

function updateGem(animate = true) {
  const g = readGem();
  const s = stage.style;

  // 크기 : 0.2ct → 0.55배 , 3ct 이상 → 1.05배
  s.setProperty('--gem-scale', (0.55 + 0.5 * g.size).toFixed(3));
  // 컷 : 좋을수록 번쩍임이 강하고 빠르게 + 무지개빛(fire)
  s.setProperty('--flash-max', (0.2 + 0.75 * g.cutF).toFixed(3));
  s.setProperty('--flash-dur', `${(4 - 1.8 * g.cutF).toFixed(2)}s`);
  s.setProperty('--fire', (0.08 + 0.26 * g.cutF).toFixed(3));
  // 컬러 : J 로 갈수록 노란빛
  s.setProperty('--tint-a', (0.65 * g.colorF).toFixed(3));
  s.setProperty('--warm', `${Math.round(g.colorF * 70)}%`);
  // 투명도 : 높을수록 선명 (흐림 / 뿌연 막 / 내포물 감소 , 주변 반짝이 증가)
  s.setProperty('--haze-a', (0.38 * (1 - g.clarityF)).toFixed(3));
  s.setProperty('--sparkle', (0.2 + 0.8 * g.clarityF).toFixed(3));
  s.setProperty('--glow', (0.25 + 0.22 * g.cutF + 0.2 * g.clarityF).toFixed(3));
  $('hazeBlur').setAttribute('stdDeviation', (1.8 * (1 - g.clarityF)).toFixed(2));
  const specks = [5, 4, 3, 2, 1, 0, 0, 0][CLARITIES.indexOf(g.clarity)];
  document.querySelectorAll('.speck').forEach((el, i) => el.classList.toggle('is-off', i >= specks));

  // 상태 게이지
  $('gsSize').textContent = `${g.carat.toFixed(2)}ct`;
  $('gsCut').textContent = g.cut;
  $('gsColor').textContent = g.color;
  $('gsClarity').textContent = g.clarity;
  $('gsSizeBar').style.width = `${8 + 92 * g.size}%`;
  $('gsCutBar').style.width = `${20 + 80 * g.cutF}%`;
  $('gsColorBar').style.width = `${100 - 85 * g.colorF}%`;
  $('gsClarityBar').style.width = `${12.5 + 87.5 * g.clarityF}%`;

  // 폼 옆 선택값 표시
  $('cutValue').textContent = `${g.cut} · ${CUT_KO[g.cut]}`;
  $('colorValue').textContent = `${g.color} · ${COLOR_KO[g.color]}`;
  $('clarityValue').textContent = `${g.clarity} · ${CLARITY_KO[g.clarity]}`;

  // 캐럿 슬라이더 채움
  const pct = (caratRange.value - caratRange.min) / (caratRange.max - caratRange.min) * 100;
  caratRange.style.setProperty('--pct', `${pct}%`);

  // 무엇이 바뀌었는지 → 알림 + 튕김 + 반짝이
  if (animate && prevGem) celebrateChange(prevGem, g);
  prevGem = g;
}

function celebrateChange(a, b) {
  let msg = '';
  let stat = null;
  if (a.cut !== b.cut) {
    msg = `✦ 광채 ${a.cut} → ${b.cut}`; stat = 'gsCut';
  } else if (a.color !== b.color) {
    msg = `✦ 컬러 ${a.color} → ${b.color}`; stat = 'gsColor';
  } else if (a.clarity !== b.clarity) {
    msg = `✦ 선명도 ${a.clarity} → ${b.clarity}`; stat = 'gsClarity';
  } else if (Math.abs(a.carat - b.carat) >= 0.005) {
    msg = `✦ 크기 ${a.carat.toFixed(2)}ct → ${b.carat.toFixed(2)}ct`; stat = 'gsSize';
  }
  if (!msg) return;

  const toast = $('stageToast');
  toast.textContent = msg;
  restartClass(toast, 'is-show');

  const box = $(stat).closest('.gs');
  restartClass(box, 'is-hit');
  clearTimeout(box._t);
  box._t = setTimeout(() => box.classList.remove('is-hit'), 900);

  // 슬라이더를 드래그할 때는 튕김만 (반짝이 과다 방지)
  const better = stat === 'gsColor' ? b.colorF < a.colorF : (b[statKey(stat)] > a[statKey(stat)]);
  if (stat !== 'gsSize') {
    restartClass($('gemPop'), 'is-pop');
    burst(better ? 34 : 14, 0.6);
  }
}

function statKey(stat) {
  return { gsCut: 'cutF', gsClarity: 'clarityF', gsSize: 'carat' }[stat];
}

function restartClass(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;   // 리플로우로 애니메이션 재시작
  el.classList.add(cls);
}

// 마우스 위치에 따라 다이아몬드 기울이기
function setupTilt() {
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    stage.style.setProperty('--ry', `${(px * 26).toFixed(1)}deg`);
    stage.style.setProperty('--rx', `${(-py * 20).toFixed(1)}deg`);
  });
  stage.addEventListener('pointerleave', () => {
    stage.style.setProperty('--ry', '0deg');
    stage.style.setProperty('--rx', '0deg');
  });
}

// =========================================================
// 3. 가격 예측 (POST /api/predict) → 서버는 예상 가격(숫자)만 반환
// =========================================================
async function handleSubmit(e) {
  e.preventDefault();
  hideError();

  const diamond = getFormData();
  setLoading(true);
  try {
    const res = await axios.post(`${API_BASE}/api/predict`, diamond);
    renderResult(res.data, diamond);
    setStatus(true);

    // 모바일(한 줄 배치)에서는 감정서로 스크롤
    if (window.innerWidth <= 1000) {
      panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  } catch (err) {
    console.error(err);
    setStatus(false);
    showError('예측 요청에 실패했습니다. 서버(AppStart.py)가 실행 중인지, 입력값이 올바른지 확인해주세요.');
  } finally {
    setLoading(false);
  }
}

// 폼 입력값 → 모델 입력 규격(JSON) : 학습 때 X 컬럼 순서와 동일
function getFormData() {
  const fd = new FormData(form);
  return {
    carat: parseFloat(fd.get('carat')),
    cut: fd.get('cut'),
    color: fd.get('color'),
    clarity: fd.get('clarity'),
    depth: parseFloat(fd.get('depth')),
    table: parseFloat(fd.get('table')),
    x: parseFloat(fd.get('x')),
    y: parseFloat(fd.get('y')),
  };
}

function renderResult(price, d) {
  const mae = METRICS.mae;
  const priceEl = $('priceValue');
  const warnings = [];

  panel.classList.remove('is-stale');
  priceEl.classList.remove('is-empty');
  hasResult = true;
  const animId = ++priceAnimId;

  if (price > 0) {
    priceEl.classList.remove('is-invalid');
    tween(lastPrice, price, 1100, (v) => { if (animId === priceAnimId) priceEl.textContent = usd.format(v); });
    lastPrice = price;
    const low = Math.max(0, price - mae);
    $('priceSub').innerHTML = `평균 오차(MAE ±${usd.format(mae)}) 기준 <b>${usd.format(low)} ~ ${usd.format(price + mae)}</b>`;
    renderGauge(price, mae);
    restartClass($('gemPop'), 'is-pop');
    burst(90, 1);
  } else {
    // 선형 모델 특성상 0 이하가 계산되는 경우
    priceEl.classList.add('is-invalid');
    priceEl.textContent = '산출 불가';
    lastPrice = 0;
    $('priceSub').innerHTML = `모델 계산값 <b>${usd.format(price)}</b> · 입력값을 다시 확인해주세요.`;
    $('gauge').hidden = true;
    warnings.push('선형 모델(Ridge) 특성상 작은 크기 · 낮은 등급 조합에서는 가격이 0 이하로 계산될 수 있습니다.');
  }

  // 예시값 그대로 예측했다면 실제 가격과 비교
  const actualEl = $('actualPrice');
  if (activeExample) {
    const diff = price - activeExample.price;
    const sign = diff >= 0 ? '+' : '−';
    actualEl.innerHTML = `데이터셋 실제 가격 <b>${usd.format(activeExample.price)}</b> · 예측 차이 <b>${sign}${usd.format(Math.abs(diff))}</b>`;
    actualEl.hidden = false;
  } else {
    actualEl.hidden = true;
  }

  // 입력 요약
  const items = [
    `${d.carat.toFixed(2)} ct`, `${d.cut}`, `${d.color} 컬러`, `${d.clarity}`,
    `깊이 ${d.depth}%`, `테이블 ${d.table}%`, `${d.x} × ${d.y} mm`,
  ];
  $('summary').innerHTML = items.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  $('warnings').innerHTML = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
}

// 가격 분포 게이지 : 백분위 위치에 마커 + MAE 범위 띠
function renderGauge(price, mae) {
  const p = percentileOf(price);
  const lo = percentileOf(Math.max(0, price - mae));
  const hi = percentileOf(price + mae);

  const gauge = $('gauge');
  gauge.hidden = false;
  void gauge.offsetWidth;   // 처음 보일 때도 0% 에서 움직이도록
  $('gaugeMarker').style.left = `${p}%`;
  $('gaugeBand').style.left = `${lo}%`;
  $('gaugeBand').style.width = `${hi - lo}%`;

  let rank;
  if (p >= 100) rank = '최고가 이상';
  else if (p <= 0) rank = '최저가 수준';
  else rank = `상위 ${Math.max(1, Math.round(100 - p))}%`;
  $('rankBadge').textContent = rank;
}

function percentileOf(price) {
  const q = PRICE_PCT;
  if (price <= q[0]) return 0;
  if (price >= q[q.length - 1]) return 100;
  for (let i = 0; i < q.length - 1; i++) {
    if (price <= q[i + 1]) return (i + (price - q[i]) / (q[i + 1] - q[i])) * 5;
  }
  return 100;
}

// =========================================================
// 4. 예시 / 초기화 / 입력 변경
// =========================================================
function fillExample() {
  const ex = EXAMPLES[exampleIndex % EXAMPLES.length];
  exampleIndex += 1;

  ['carat', 'depth', 'table', 'x', 'y'].forEach((k) => { form.elements[k].value = ex[k]; });
  ['cut', 'color', 'clarity'].forEach((k) => {
    form.querySelector(`input[name="${k}"][value="${ex[k]}"]`).checked = true;
  });
  syncRange();

  prevGem = null;           // 예시는 한 번에 여러 값이 바뀌므로 개별 알림 대신 전체 효과
  updateGem(false);
  restartClass($('gemPop'), 'is-pop');
  burst(40, 0.7);

  activeExample = ex;
  const note = $('exampleNote');
  note.textContent = `✦ 예시 ${((exampleIndex - 1) % EXAMPLES.length) + 1}/${EXAMPLES.length} · 테스트 데이터의 실제 다이아몬드입니다. 감정 후 실제 가격과 비교해보세요.`;
  note.hidden = false;
  markStale();
}

function handleReset() {
  // reset 이벤트는 값이 초기화되기 "전"에 발생 → 다음 틱에 화면 정리
  setTimeout(() => {
    syncRange();
    prevGem = null;
    updateGem(false);
    activeExample = null;
    hasResult = false;
    lastPrice = 0;
    priceAnimId += 1;
    $('exampleNote').hidden = true;
    const priceEl = $('priceValue');
    priceEl.className = 'price is-empty';
    priceEl.textContent = '$ —';
    $('priceSub').innerHTML = DEFAULT_SUB;
    $('gauge').hidden = true;
    $('actualPrice').hidden = true;
    $('summary').innerHTML = '';
    $('warnings').innerHTML = '';
    panel.classList.remove('is-stale');
    hideError();
  });
}

function syncRange() {
  const v = parseFloat(caratInput.value);
  if (!Number.isNaN(v)) caratRange.value = Math.min(Math.max(v, caratRange.min), caratRange.max);
}

// 사용자가 값을 바꾸면 : 다이아몬드 즉시 반영 + 예시 비교 해제 + 이전 결과 흐리게
function handleUserInput(e) {
  if (e.target === caratRange) caratInput.value = parseFloat(caratRange.value).toFixed(2);
  if (e.target === caratInput) syncRange();
  updateGem(true);
  if (activeExample) {
    activeExample = null;
    $('exampleNote').hidden = true;
  }
  markStale();
}

function markStale() {
  if (hasResult) panel.classList.add('is-stale');
}

// =========================================================
// 5. 모델 성능 지표 (스크롤로 보이면 애니메이션)
// =========================================================
function setupMetrics() {
  const m = METRICS;
  $('testCount').textContent = `테스트 데이터 ${num.format(m.test_count)}건 기준 · abj-01.py 학습 결과`;
  $('modelName').textContent = m.model;
  $('r2Desc').textContent = `가격 변동의 약 ${(m.r2 * 100).toFixed(1)}%를 모델이 설명합니다. 1에 가까울수록 정확합니다.`;
  $('rmseCap').textContent = `평균 가격 ${usd.format(AVG_PRICE)} 대비 ${(m.rmse / AVG_PRICE * 100).toFixed(1)}%`;
  $('maeCap').textContent = `평균 가격 ${usd.format(AVG_PRICE)} 대비 ${(m.mae / AVG_PRICE * 100).toFixed(1)}%`;

  const ring = $('r2Ring');
  const C = 2 * Math.PI * 58;
  ring.style.strokeDasharray = `${C}`;
  ring.style.strokeDashoffset = `${C}`;

  const play = () => {
    ring.style.strokeDashoffset = `${C * (1 - Math.min(1, Math.max(0, m.r2)))}`;
    $('rmseBar').style.width = `${Math.min(100, m.rmse / AVG_PRICE * 100)}%`;
    $('maeBar').style.width = `${Math.min(100, m.mae / AVG_PRICE * 100)}%`;
    tween(0, m.r2, 1800, (v) => { $('r2Value').textContent = v.toFixed(4); });
    tween(0, m.rmse, 1800, (v) => { $('rmseValue').textContent = usd.format(v); });
    tween(0, m.mae, 1800, (v) => { $('maeValue').textContent = usd.format(v); });
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { play(); io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe($('metrics'));
  } else {
    play();
  }
}

// =========================================================
// 6. 효과 : 반짝이 폭발 / 배경 별 / 카드 조명
// =========================================================
const burstCanvas = $('burstCanvas');
const bctx = burstCanvas.getContext('2d');
let sparks = [];
let burstRunning = false;

function burst(count, power) {
  restartClass(stage, 'is-burst');
  if (reduceMotion) return;

  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (burstCanvas.width !== Math.round(r.width * dpr)) {
    burstCanvas.width = Math.round(r.width * dpr);
    burstCanvas.height = Math.round(r.height * dpr);
  }
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx = r.width / 2;
  const cy = r.height * 0.47;
  const colors = ['#ffffff', '#8fd3ff', '#b08cff', '#ffd68a', '#ff9ccf'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (1.5 + Math.random() * 5.5) * power;
    sparks.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.8,
      life: 0, max: 45 + Math.random() * 55,
      size: 1 + Math.random() * 2.6,
      color: colors[i % colors.length],
      star: Math.random() < 0.3,
    });
  }
  if (!burstRunning) {
    burstRunning = true;
    requestAnimationFrame(stepBurst);
  }
}

function stepBurst() {
  bctx.save();
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, burstCanvas.width, burstCanvas.height);
  bctx.restore();

  sparks = sparks.filter((p) => p.life < p.max);
  for (const p of sparks) {
    p.life += 1;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.965;
    p.vy = p.vy * 0.965 + 0.05;
    bctx.globalAlpha = 1 - p.life / p.max;
    bctx.fillStyle = p.color;
    if (p.star) {
      drawStar(bctx, p.x, p.y, p.size * 2.6);
    } else {
      bctx.beginPath();
      bctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      bctx.fill();
    }
  }
  bctx.globalAlpha = 1;

  if (sparks.length) requestAnimationFrame(stepBurst);
  else burstRunning = false;
}

function drawStar(ctx, x, y, r) {
  const k = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + k, y - k);
  ctx.lineTo(x + r, y); ctx.lineTo(x + k, y + k);
  ctx.lineTo(x, y + r); ctx.lineTo(x - k, y + k);
  ctx.lineTo(x - r, y); ctx.lineTo(x - k, y - k);
  ctx.closePath();
  ctx.fill();
}

// 배경 : 천천히 떠오르며 반짝이는 별
function startBackground() {
  const cv = $('bgCanvas');
  const ctx = cv.getContext('2d');
  let w = 0;
  let h = 0;
  let stars = [];
  const hues = [205, 265, 42];

  const makeStar = () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * 0.06,
    vy: -(Math.random() * 0.16 + 0.03),
    t: Math.random() * Math.PI * 2,
    ts: Math.random() * 0.025 + 0.006,
    hue: hues[Math.floor(Math.random() * hues.length)],
  });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round(Math.min(130, (w * h) / 12000)) }, makeStar);
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      if (!reduceMotion) {
        s.x += s.vx;
        s.y += s.vy;
        s.t += s.ts;
        if (s.y < -6) { s.y = h + 6; s.x = Math.random() * w; }
      }
      const a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(s.t));
      ctx.globalAlpha = a;
      ctx.fillStyle = `hsl(${s.hue}, 90%, 82%)`;
      if (s.r > 1.5 && a > 0.65) drawStar(ctx, s.x, s.y, s.r * 3);
      else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (!reduceMotion) requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', () => { resize(); if (reduceMotion) draw(); });
  draw();
}

// 카드 위 마우스를 따라다니는 조명
function setupSpotlight() {
  document.querySelectorAll('.spot').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// =========================================================
// 공통 함수
// =========================================================
function tween(from, to, ms, onUpdate) {
  if (reduceMotion) { onUpdate(to); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    onUpdate(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setStatus(ok) {
  const el = $('serverStatus');
  el.classList.toggle('is-ok', ok);
  el.classList.toggle('is-down', !ok);
  el.querySelector('span').textContent = ok ? '모델 서버 연결됨' : '서버 연결 실패';
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle('is-loading', on);
  submitBtn.querySelector('.btn__label').textContent = on ? '감정 중…' : 'AI 감정 시작';
}

function showError(msg) {
  const el = $('errorMsg');
  el.textContent = msg;
  el.hidden = false;
}

function hideError() {
  $('errorMsg').hidden = true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// =========================================================
// 시작
// =========================================================
form.addEventListener('submit', handleSubmit);
form.addEventListener('reset', handleReset);
form.addEventListener('input', handleUserInput);   // 캐럿 슬라이더 포함 (슬라이더는 name 이 없어 전송 데이터에는 빠짐)
$('exampleBtn').addEventListener('click', fillExample);

$('priceSub').innerHTML = DEFAULT_SUB;
buildGem();
updateGem(false);
setupTilt();
setupSpotlight();
setupMetrics();
startBackground();
