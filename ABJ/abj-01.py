import pandas as pd
df = pd.read_csv("./dataset/diamonds.csv")
# df.info()
# df.head()

# Unnamed: 0 삭제. 
# z 삭제.

df = df.drop( columns=['Unnamed: 0' , 'z']).reset_index(drop=True)
df = df[ (df['x'] > 0) & (df['y'] > 0)].reset_index(drop=True)
# df.head()
df.info()

X = df.drop( columns=['price']).copy()
Y = df['price']

from sklearn.model_selection import train_test_split
X_train , X_test , Y_train, Y_test = train_test_split(X , Y , test_size=0.2 , random_state=42)

num_features = [ 'carat' , 'depth' , 'table' , 'x' , 'y']
cat_features = [ 'cut' , 'color' , 'clarity' ]

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler , OneHotEncoder
ct = ColumnTransformer( transformers= [
    ( 'num' , StandardScaler() , num_features ) , 
    ( 'cat' , OneHotEncoder( drop='first' , sparse_output=False ) , cat_features )
] )

from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression , Ridge
pipe = Pipeline( [ ('ct' , ct) , ('ridge' , Ridge() ) ] )

from sklearn.model_selection import KFold
kf = KFold( n_splits=5 , shuffle=True , random_state=42 )

from sklearn.model_selection import GridSearchCV
param_grid = { 'ridge__alpha' : [0.01 , 0.1, 1.0 ,10.0,100.0] }
grid = GridSearchCV( estimator=pipe , param_grid=param_grid , scoring='r2' , cv=kf , n_jobs=-1)

grid.fit(X_train , Y_train)

best_pipe = grid.best_estimator_

best_params = grid.best_params_
best_score = grid.best_score_

print(best_params)
print(best_score)

Y_pred =  best_pipe.predict(X_test)

import numpy as np
from sklearn.metrics import r2_score , mean_squared_error , mean_absolute_error
r2 = r2_score(Y_test, Y_pred)
rmse = np.sqrt( mean_squared_error(Y_test, Y_pred) )
mae = mean_absolute_error(Y_test, Y_pred)
print('R2 :', r2)        # 1에 가까울수록 좋음 (요구사항의 회귀 지표)
print('RMSE :', rmse)    # 평균 오차 (달러)
print('MAE :', mae)      # 평균 절대 오차 (달러)


import joblib
joblib.dump(best_pipe , './best_model.pkl')

best_model = joblib.load('./best_model.pkl')







import matplotlib.pyplot as plt
import seaborn as sns
sns.heatmap(data=df[ ['carat' ,'depth', 'table' ,'price', 'x' ,'y'] ].corr() , annot=True , fmt= '.2f')
plt.show()

test_df = df[['price', 'cut', 'color', 'clarity']]
test_df = pd.get_dummies(test_df, columns=['cut', 'color', 'clarity'], dtype=int)   # price 는 빼고 인코딩

price_corr = test_df.corr()[['price']].drop('price').sort_values('price', ascending=False)
plt.figure(figsize=(4, 8))
sns.heatmap(price_corr, annot=True, fmt='.2f', cmap='coolwarm', center=0, vmin=-1, vmax=1)
plt.show()




