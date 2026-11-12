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

// 예시값 : 테스트 데이터에서 무작위로 뽑은 실제 다이아몬드 (price = 실제 가격)
const EXAMPLES = [
  { carat: 0.43, cut: 'Good',      color: 'F', clarity: 'VS1', depth: 57.9, table: 61, x: 4.99, y: 5.03, price: 931 },
  { carat: 0.71, cut: 'Premium',   color: 'D', clarity: 'VS2', depth: 62.7, table: 58, x: 5.53, y: 5.67, price: 2659 },
  { carat: 1.02, cut: 'Ideal',     color: 'F', clarity: 'I1',  depth: 61.0, table: 56, x: 6.53, y: 6.51, price: 3599 },
  { carat: 1.52, cut: 'Very Good', color: 'D', clarity: 'SI2', depth: 58.6, table: 59, x: 7.43, y: 7.48, price: 9817 },
];

// ===== 화면 요소 =====
const $ = (id) => document.getElementById(id);
const form = $('predictForm');
const caratRange = $('caratRange');
const caratInput = $('carat');
const submitBtn = $('submitBtn');
const resultCard = $('resultCard');

let exampleIndex = 0;
let activeExample = null;   // 예시값을 채운 뒤 수정하지 않았으면 실제 가격 비교 표시
let lastPrice = 0;          // 숫자 애니메이션 시작값
let hasResult = false;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('ko-KR');

// ===== 1. 성능 지표 표시 =====
function renderMetrics(m) {
  $('r2Value').textContent = m.r2.toFixed(4);
  $('r2Bar').style.width = `${Math.max(0, Math.min(1, m.r2)) * 100}%`;
  $('r2Desc').textContent = `가격 변동의 약 ${(m.r2 * 100).toFixed(1)}%를 설명합니다. (1에 가까울수록 정확)`;
  $('rmseValue').textContent = usd.format(m.rmse);
  $('maeValue').textContent = usd.format(m.mae);
  $('testCount').textContent = `테스트 데이터 ${num.format(m.test_count)}건 기준`;
  $('modelName').textContent = `모델 : ${m.model} · 저장된 best_model.pkl 로 예측`;
}

// ===== 2. 가격 예측 (POST /api/predict) =====
async function handleSubmit(e) {
  e.preventDefault();
  hideError();

  const diamond = getFormData();
  setLoading(true);
  try {
    // 서버는 예상 가격(숫자)만 반환
    const res = await axios.post(`${API_BASE}/api/predict`, diamond);
    renderResult(res.data, diamond);
    setStatus(true);

    // 모바일(한 줄 배치)에서는 결과 카드로 스크롤
    if (window.innerWidth <= 960) {
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  $('resultEmpty').hidden = true;
  $('resultBody').hidden = false;
  resultCard.classList.remove('is-stale');
  hasResult = true;

  // 예측 가격
  if (price > 0) {
    priceEl.classList.remove('is-invalid');
    animateNumber(priceEl, lastPrice, price);
    lastPrice = price;
    const low = Math.max(0, price - mae);
    $('priceSub').innerHTML =
      `평균 오차(MAE) 기준 예상 범위 <b>${usd.format(low)} ~ ${usd.format(price + mae)}</b>`;
  } else {
    // 선형 모델 특성상 0 이하가 계산되는 경우
    priceEl.classList.add('is-invalid');
    priceEl.textContent = '산출 불가';
    lastPrice = 0;
    $('priceSub').innerHTML = `모델 계산값 <b>${usd.format(price)}</b> · 입력값을 다시 확인해주세요.`;
    warnings.push('선형 모델(Ridge) 특성상 작은 크기 · 낮은 등급 조합에서는 가격이 0 이하로 계산될 수 있습니다.');
  }

  // 예시값 그대로 예측했다면 실제 가격과 비교
  const actualEl = $('actualPrice');
  if (activeExample) {
    const diff = price - activeExample.price;
    const sign = diff >= 0 ? '+' : '−';
    actualEl.innerHTML =
      `데이터셋 실제 가격 <b>${usd.format(activeExample.price)}</b> · 예측 차이 <b>${sign}${usd.format(Math.abs(diff))}</b>`;
    actualEl.hidden = false;
  } else {
    actualEl.hidden = true;
  }

  // 입력 요약
  const items = [
    `${d.carat.toFixed(2)} ct`,
    `${d.cut} 컷`,
    `${d.color} 컬러`,
    `${d.clarity} 투명도`,
    `깊이 ${d.depth}%`,
    `테이블 ${d.table}%`,
    `${d.x} × ${d.y} mm`,
  ];
  $('summary').innerHTML = items.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
  $('warnings').innerHTML = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
}

// ===== 3. 예시값 / 초기화 / 입력 동기화 =====
function fillExample() {
  const ex = EXAMPLES[exampleIndex % EXAMPLES.length];
  exampleIndex += 1;

  ['carat', 'depth', 'table', 'x', 'y'].forEach((k) => { form.elements[k].value = ex[k]; });
  ['cut', 'color', 'clarity'].forEach((k) => {
    form.querySelector(`input[name="${k}"][value="${ex[k]}"]`).checked = true;
  });
  syncRange();

  activeExample = ex;
  const note = $('exampleNote');
  note.textContent = `예시 ${((exampleIndex - 1) % EXAMPLES.length) + 1}/${EXAMPLES.length} · 테스트 데이터의 실제 다이아몬드입니다. 예측 후 실제 가격과 비교해보세요.`;
  note.hidden = false;
  markStale();
}

function handleReset() {
  // reset 이벤트는 값이 초기화되기 "전"에 발생 → 다음 틱에 화면 정리
  setTimeout(() => {
    syncRange();
    activeExample = null;
    hasResult = false;
    lastPrice = 0;
    $('exampleNote').hidden = true;
    $('resultEmpty').hidden = false;
    $('resultBody').hidden = true;
    resultCard.classList.remove('is-stale');
    hideError();
  });
}

function syncRange() {
  const v = parseFloat(caratInput.value);
  if (!Number.isNaN(v)) caratRange.value = Math.min(Math.max(v, caratRange.min), caratRange.max);
}

// 사용자가 값을 바꾸면 : 예시 비교 해제 + 이전 결과 흐리게
function handleUserInput(e) {
  if (e.target === caratRange) caratInput.value = parseFloat(caratRange.value).toFixed(2);
  if (e.target === caratInput) syncRange();
  if (activeExample) {
    activeExample = null;
    $('exampleNote').hidden = true;
  }
  markStale();
}

function markStale() {
  if (hasResult) resultCard.classList.add('is-stale');
}

// ===== 공통 함수 =====
function setStatus(ok) {
  const el = $('serverStatus');
  el.classList.toggle('is-ok', ok);
  el.classList.toggle('is-down', !ok);
  el.querySelector('span').textContent = ok ? '모델 서버 연결됨' : '서버 연결 실패';
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle('is-loading', on);
  submitBtn.querySelector('.btn__label').textContent = on ? '계산 중…' : '예상 가격 확인';
}

function showError(msg) {
  const el = $('errorMsg');
  el.textContent = msg;
  el.hidden = false;
}

function hideError() {
  $('errorMsg').hidden = true;
}

function animateNumber(el, from, to) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.textContent = usd.format(to); return; }
  const duration = 700;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = usd.format(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== 이벤트 연결 =====
form.addEventListener('submit', handleSubmit);
form.addEventListener('reset', handleReset);
form.addEventListener('input', handleUserInput);   // 캐럿 슬라이더 포함 (슬라이더는 name 이 없어 전송 데이터에는 빠짐)
$('exampleBtn').addEventListener('click', fillExample);

renderMetrics(METRICS);
