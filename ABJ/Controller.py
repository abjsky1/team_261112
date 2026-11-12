from fastapi import APIRouter
router = APIRouter( prefix= '/api')

# 서비스 객체 불러오기

from Service import diamond_service

# 가격 예측

@router.post('/predict')
async def predict( diamond:dict ):
    # 서비스 안에 함수 호출 → 예상 가격(숫자) 반환
    return diamond_service.predict( diamond )
