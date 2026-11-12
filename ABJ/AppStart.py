# 파이썬 파일 분리
# AppStart.py    : FastAPI 실행 파일
# Controller.py  : HTTP REST 파일
# Service.py     : 로직 파일 (저장된 best_model.pkl 로 다이아몬드 가격 예측)

# 실행 방법 : AppStart.py 실행(py) → 브라우저에서 http://127.0.0.1:8000 접속
# REST API 확인 : http://127.0.0.1:8000/docs
# 서버 종료 : 해당 서버 터미널에서 'Ctrl + C'

from fastapi import FastAPI
import uvicorn

app = FastAPI( )
if __name__ == "__main__":
    uvicorn.run( 'AppStart:app' , host="127.0.0.1" , port=8000 , reload=True )

# CORS 허용
# - HTML 파일을 직접 열거나(Live Server 등) 다른 주소(포트)에서 axios 요청을 해도 통신 가능하도록
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware( CORSMiddleware , allow_origins=["*"] , allow_methods=["*"] , allow_headers=["*"] )

import Controller
app.include_router( Controller.router )

# 화면(HTML / CSS / JS) 연결
# - http://127.0.0.1:8000 접속 시 static 폴더의 index.html 을 보여줌
# - 주의 : '/' 로 마운트하면 모든 주소를 화면이 가져가므로 반드시 라우터 연결 "이후"에 작성
import os
from fastapi.staticfiles import StaticFiles
# AppStart.py 가 있는 폴더 기준으로 static 폴더 경로 지정 (어느 위치에서 실행해도 동작)
STATIC_DIR = os.path.join( os.path.dirname( os.path.abspath(__file__) ) , 'static' )
app.mount( '/' , StaticFiles( directory=STATIC_DIR , html=True ) , name='static' )
