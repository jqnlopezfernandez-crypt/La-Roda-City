import cv2, numpy as np
from scipy import ndimage as ndi
from skimage.morphology import skeletonize
R=__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)),"..","public","referencias")+"/"
tr=cv2.imread(R+"trazado-fondo-negro-original.jpeg")
hsv=cv2.cvtColor(tr,cv2.COLOR_BGR2HSV)
white=(tr.min(axis=2)>170); white[:60,950:]=False
red=((hsv[...,0]<10)|(hsv[...,0]>170))&(hsv[...,1]>120)&(hsv[...,2]>120)
# red marks touching strokes count as stroke (annotation painted over street)
grow=ndi.binary_dilation(white,iterations=3)
stroke=white|(red&grow)
stroke=ndi.binary_closing(stroke,iterations=2)
lab,n=ndi.label(stroke,structure=np.ones((3,3)));print("components after healing red overlaps:",n)
holes=~stroke
hl,hn=ndi.label(holes)
border=set(np.unique(np.r_[hl[0],hl[-1],hl[:,0],hl[:,-1]]))
dt=cv2.distanceTransform(holes.astype(np.uint8),cv2.DIST_L2,5)
res=[]
for i in range(1,hn+1):
    if i in border: continue
    m=hl==i; a=int(m.sum())
    if a<30: continue
    ys,xs=np.nonzero(m)
    res.append((2*dt[m].max(),a,int(xs.mean()),int(ys.mean())))
res.sort()
print("closed blocks:",len(res))
for r in res[:8]: print("block centre (%d,%d) area %d px, max inscribed width %.1f px"%(r[2],r[3],r[1],r[0]))
sk=skeletonize(stroke)
k=np.ones((3,3));k[1,1]=0
nb=ndi.convolve(sk.astype(int),k,mode='constant')*sk
print("skeleton px",int(sk.sum()),"endpoints",int((nb==1).sum()))
