# 비지니스 로직 == 머신러닝 모델 예측
import joblib
import pandas as pd

# 클래스 생성
class DiamondService :
    
    def __init__(self):
        self.best_model = joblib.load('./best_model.pkl')

    def predict( self , diamond ) :
        df = pd.DataFrame( [diamond] )
        price = self.best_model.predict( df )[0]
        return round( float(price) , 2 )

#----------------------------------------------------------------
# 클래스 밖
# 서비스 객체 생성
# 인스턴스 직접 만들기
diamond_service = DiamondService()
