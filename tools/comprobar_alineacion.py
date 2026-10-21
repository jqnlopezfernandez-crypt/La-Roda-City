import cv2, numpy as np, sys
R=__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)),"..","public","referencias")+"/"
tr=cv2.imread(R+"trazado-fondo-negro-original.jpeg")
mp=cv2.imread(R+"mapa-con-trazado-original.jpeg")
# trace: white strokes on black
tw=((tr.min(axis=2)>170)).astype(np.uint8)
tw[:60, 950:]=0  # corner artefact top-right
# map: white strokes, low saturation & bright
hsv=cv2.cvtColor(mp,cv2.COLOR_BGR2HSV)
mw=((mp.min(axis=2)>200)&(hsv[...,1]<40)).astype(np.uint8)
mw[:80,:]=0; mw[1380:,:]=0; mw[:, 2150:]=0
dt=cv2.distanceTransform((1-mw).astype(np.uint8),cv2.DIST_L2,3)
ys,xs=np.nonzero(tw); idx=np.random.default_rng(0).choice(len(xs),min(6000,len(xs)),replace=False)
P=np.stack([xs[idx],ys[idx]],1).astype(float)
def cost(s,tx,ty,th=0.0):
    c,sn=np.cos(th),np.sin(th)
    X=s*(c*P[:,0]-sn*P[:,1])+tx; Y=s*(sn*P[:,0]+c*P[:,1])+ty
    ok=(X>=0)&(Y>=0)&(X<mp.shape[1]-1)&(Y<mp.shape[0]-1)
    d=np.full(len(X),60.0); d[ok]=np.minimum(dt[Y[ok].astype(int),X[ok].astype(int)],60)
    return d.mean()
# init from two endpoint landmarks read by eye
best=(1e9,None)
for s in np.linspace(0.95,1.05,21):
  for tx in range(700,840,4):
    for ty in range(120,220,4):
      c=cost(s,tx,ty)
      if c<best[0]: best=(c,(s,tx,ty))
print("coarse",best)
from scipy.optimize import minimize
r=minimize(lambda v:cost(*v),[*best[1],0.0],method="Nelder-Mead",options=dict(xatol=0.01,fatol=0.001,maxiter=2000,initial_simplex=None))
print("refined",r.x,r.fun)
s,tx,ty,th=r.x
c,sn=np.cos(th),np.sin(th)
X=s*(c*P[:,0]-sn*P[:,1])+tx; Y=s*(sn*P[:,0]+c*P[:,1])+ty
d=dt[np.clip(Y.astype(int),0,mp.shape[0]-1),np.clip(X.astype(int),0,mp.shape[1]-1)]
print("dist px: median %.2f p90 %.2f p99 %.2f"%(np.median(d),np.percentile(d,90),np.percentile(d,99)))
M=np.array([[s*c,-s*sn,tx],[s*sn,s*c,ty]])
print("matriz",M.round(3).tolist())
warp=cv2.warpAffine(tr,M,(mp.shape[1],mp.shape[0]))
ov=mp.copy(); m=warp.min(axis=2)>170
ov[m]=(0,0,255)
cv2.imwrite(R+"_comprobacion-alineacion.jpg",ov[100:1300,700:2000])
