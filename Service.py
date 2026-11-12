import pandas as pd 
class ItemService :  
    def __init__(self):
        # 학습시킨걸 불러와야하나???
        self.df = pd.read_csv( './dataset/diamonds.csv')
        
    def save( self , item ) :
        # df로 변환
        saveDf = pd.DataFrame( [item] )

        # 값들을 넣고 예측

        
        
        return True # 예측한 값을 반환

item_service = ItemService()