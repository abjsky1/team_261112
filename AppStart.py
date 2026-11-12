
from fastapi import FastAPI
import uvicorn
app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware( CORSMiddleware , allow_origins=["*"] , allow_methods=["*"] , allow_headers=["*"] )

if __name__ == "__main__":
    uvicorn.run( 'AppStart:app', 
                host="127.0.0.1", 
                port=8000, reload=True )

import Controller # import 파일명

app.include_router( Controller.router )