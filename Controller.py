from fastapi import APIRouter

router = APIRouter( prefix="/api")
from Service import item_service

@router.post("/save")
async def save( item:dict ) :
    return item_service.save( item )