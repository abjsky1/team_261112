// ===== 설정 =====
// FastAPI 서버 주소 + 예측 엔드포인트 ( 백엔드 만들 때 이 주소에 맞추거나, 여기를 수정 )
const API_URL = "http://127.0.0.1:8000/api/predict";
const USD_TO_KRW = 1400; // 원화 환산용 대략적인 환율

// 요청 형식 (POST, JSON)
// { "carat": 1.0, "depth": 61.5, "table": 57, "x": 6.4, "y": 6.4,
//   "cut": "Ideal", "color": "G", "clarity": "VS1" }
//
// 응답 형식 (JSON)
// { "price": 5123.45, "r2": 0.919 }

// ===== 입력 항목 정의 =====
const NUM_FIELDS = [
    { id: "carat", label: "캐럿" },
    { id: "x", label: "가로 길이 (mm)" },
    { id: "y", label: "세로 길이 (mm)" },
    { id: "depth", label: "깊이 비율 (%)" },
    { id: "table", label: "테이블 비율 (%)" },
];
const CAT_FIELDS = [
    { id: "cut", label: "컷 등급" },
    { id: "color", label: "색상 등급" },
    { id: "clarity", label: "투명도 등급" },
];

// ===== 화면 요소 =====
const form = document.querySelector("#predictForm");
const submitBtn = document.querySelector("#submitBtn");
const resetBtn = document.querySelector("#resetBtn");
const formError = document.querySelector("#formError");

const resultEmpty = document.querySelector("#resultEmpty");
const resultLoading = document.querySelector("#resultLoading");
const resultError = document.querySelector("#resultError");
const resultErrorMsg = document.querySelector("#resultErrorMsg");
const resultBox = document.querySelector("#resultBox");

// 기본값 저장 ( 초기화 버튼용 )
const defaults = {};
[...NUM_FIELDS, ...CAT_FIELDS].forEach(f => {
    defaults[f.id] = document.querySelector("#" + f.id).value;
});

// ===== 결과 영역 상태 전환 : empty / loading / error / result =====
function showState(state) {
    resultEmpty.classList.toggle("hidden", state !== "empty");
    resultLoading.classList.toggle("hidden", state !== "loading");
    resultError.classList.toggle("hidden", state !== "error");
    resultBox.classList.toggle("hidden", state !== "result");
}

// ===== 입력값 검사 + 요청 데이터 만들기 =====
function collectData() {
    const data = {};
    const errors = [];

    NUM_FIELDS.forEach(f => {
        const input = document.querySelector("#" + f.id);
        const value = parseFloat(input.value);
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);

        if (isNaN(value) || value < min || value > max) {
            input.classList.add("invalid");
            errors.push(`${f.label}: ${min} ~ ${max} 사이로 입력해 주세요.`);
        } else {
            input.classList.remove("invalid");
            data[f.id] = value; // 숫자로 전송
        }
    });

    CAT_FIELDS.forEach(f => {
        data[f.id] = document.querySelector("#" + f.id).value; // 문자로 전송
    });

    return { data, errors };
}

// ===== 결과 그리기 =====
function renderResult(result, sent) {
    const price = Number(result.price);
    const r2 = Number(result.r2);

    document.querySelector("#priceUsd").textContent =
        "$" + price.toLocaleString("en-US", { maximumFractionDigits: 0 });
    document.querySelector("#priceKrw").textContent =
        "약 " + Math.round(price * USD_TO_KRW).toLocaleString("ko-KR") + "원";

    document.querySelector("#r2Value").textContent = r2.toFixed(3);
    document.querySelector("#r2Bar").style.width = Math.max(0, Math.min(1, r2)) * 100 + "%";
    document.querySelector("#r2Desc").textContent =
        `테스트 데이터 기준, 가격 변동의 ${(r2 * 100).toFixed(1)}%를 설명합니다.`;

    // 입력한 정보 요약
    const list = document.querySelector("#summaryList");
    list.innerHTML = "";
    [...NUM_FIELDS, ...CAT_FIELDS].forEach(f => {
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = f.label;
        dd.textContent = sent[f.id];
        list.append(dt, dd);
    });

    showState("result");
}

// ===== 오류 메시지 만들기 =====
function errorMessage(err) {
    if (err.response) {
        // 서버가 응답은 했지만 오류 (예: 422 입력 형식 오류, 500 서버 오류)
        const detail = err.response.data && err.response.data.detail;
        return `서버 오류 (${err.response.status})` + (detail ? `: ${JSON.stringify(detail)}` : "");
    }
    if (err.request) {
        // 응답 자체가 없음 → 서버 꺼짐 또는 CORS 문제
        return `서버에 연결할 수 없습니다. FastAPI 서버가 ${API_URL} 에서 실행 중인지, CORS 설정이 되어 있는지 확인해 주세요.`;
    }
    return err.message;
}

// ===== 예측 요청 : axios 비동기 통신 =====
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // 폼 기본 동작(페이지 새로고침) 막기

    const { data, errors } = collectData();
    if (errors.length > 0) {
        formError.textContent = errors[0];
        return;
    }
    formError.textContent = "";

    submitBtn.disabled = true;
    submitBtn.textContent = "예측 중...";
    showState("loading");

    try {
        const response = await axios.post(API_URL, data);
        renderResult(response.data, data);
    } catch (err) {
        console.error(err);
        resultErrorMsg.textContent = errorMessage(err);
        showState("error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "가격 예측하기";
    }
});

// ===== 초기화 =====
resetBtn.addEventListener("click", () => {
    Object.entries(defaults).forEach(([id, value]) => {
        const el = document.querySelector("#" + id);
        el.value = value;
        el.classList.remove("invalid");
    });
    formError.textContent = "";
    showState("empty");
});

// 입력값을 고치면 빨간 표시 지우기
NUM_FIELDS.forEach(f => {
    document.querySelector("#" + f.id).addEventListener("input", (e) => {
        e.target.classList.remove("invalid");
    });
});
