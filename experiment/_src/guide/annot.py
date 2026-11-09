import json
from PIL import Image, ImageDraw, ImageFont
S=2
D='/home/claude/guide/shots/'; O='/home/claude/guide/img/'
R=json.load(open(D+'rects.json'))
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(sz):
    try: return ImageFont.truetype(FB, sz)
    except: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', sz)
ORANGE=(230,110,20); RED=(214,40,40)
def box(d, r, pad=5, col=RED, w=6):
    x,y,ww,hh=r['x']*S-pad*S, r['y']*S-pad*S, r['w']*S+2*pad*S, r['h']*S+2*pad*S
    d.rounded_rectangle([x,y,x+ww,y+hh], radius=12*S//2, outline=col, width=w)
    return (x,y,ww,hh)
def badge(d, x, y, t, col=RED, r=30):
    d.ellipse([x-r*S//2*1, y-r*S//2*1, x+r*S//2*1, y+r*S//2*1], fill=col, outline=(255,255,255), width=4)
    f=font(int(r*0.95)); tw=d.textlength(t, font=f)
    d.text((x-tw/2, y-r*0.62), t, fill=(255,255,255), font=f)
def crop(im, x0,y0,x1,y1, name, maxw=1400):
    c=im.crop((int(x0*S),int(y0*S),int(x1*S),int(y1*S)))
    c.save(O+name); return c
# 1 開いたところ
im=Image.open(D+'s1_hand.png').convert('RGB'); d=ImageDraw.Draw(im)
h=box(d,R['s1h']['start'],pad=3); badge(d, h[0]-6, h[1]+8, '1')
vb=R['s1h']['vb']; crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'g1_open.png')
# 手でクリック：マーカーと［1回分トラッキングを取り消す］
im=Image.open(D+'sh_hand.png').convert('RGB'); d=ImageDraw.Draw(im)
m=R['sh']['mk']; m2={'x':m['x']-4,'y':m['y']-4,'w':m['w']+8,'h':m['h']+8}
b=box(d,m2,pad=2); badge(d, b[0]+b[2]+6, b[1]-4, '2')
box(d,R['sh']['undo'],pad=3,col=ORANGE)
vb=R['sh']['vb']; crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'g8_hand.png')
# 2 マーカーをクリック
im=Image.open(D+'s2_color.png').convert('RGB'); d=ImageDraw.Draw(im)
m=R['s2']['mk']; m2={'x':m['x']-4,'y':m['y']-4,'w':m['w']+8,'h':m['h']+8}
b=box(d,m2,pad=2); badge(d, b[0]-4, b[1]-4, '2')
vb=R['s2']['vb']; crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'g2_color.png')
# 3 自動追跡を開始する
im=Image.open(D+'s3_radius.png').convert('RGB'); d=ImageDraw.Draw(im)
b=box(d,R['s3']['start']); badge(d, b[0]-4, b[1]+6, '4')
vb=R['s3']['vb']; crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'g3_start.png')
# 4 解析終了
im=Image.open(D+'s4_done.png').convert('RGB'); d=ImageDraw.Draw(im)
vb=R['s4']['vb']; crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'g4_done.png')
# 5 ②グラフ・動画と一緒に再生・レポートPDF
im=Image.open(D+'s6_live.png').convert('RGB'); d=ImageDraw.Draw(im)
b=box(d,R['s6']['tab2']); badge(d, b[0]-4, b[1]+6, '1')
b=box(d,R['s6']['live']); badge(d, b[0]-4, b[1]+6, '2')
b=box(d,R['s6']['play']); badge(d, b[0]-4, b[1]+6, '3')
b=box(d,R['s6']['pdf'],col=ORANGE); badge(d, b[0]-4, b[1]+6, '4', col=ORANGE)
crop(im, 0, 95, 1366, 800, 'g5_live.png')
# 6 ストロボ・名前
im=Image.open(D+'s7_stro.png').convert('RGB'); d=ImageDraw.Draw(im)
bx=R['s7']['box']; b=box(d,R['s7']['yes'],col=ORANGE); badge(d, b[0]-4, b[1]+6, '5', col=ORANGE)
crop(im, bx['x']-8, bx['y']-8, bx['x']+bx['w']+8, bx['y']+bx['h']+8, 'g6_stro.png')
im=Image.open(D+'s8_name.png').convert('RGB'); d=ImageDraw.Draw(im)
bx=R['s8']['box']; b=box(d,R['s8']['ok'],col=ORANGE); badge(d, b[0]-4, b[1]+6, '6', col=ORANGE)
crop(im, bx['x']-8, bx['y']-8, bx['x']+bx['w']+8, bx['y']+bx['h']+8, 'g7_name.png')
print('ok')
# ===== 第69回：手でクリックの続き・色マーカー =====
BLUE=(40,90,200)
def strip(name, src, y0f=0.26, y1f=0.74, x0f=0.0, x1f=1.0, draw=None):
    im=Image.open(D+src+'.png').convert('RGB'); d=ImageDraw.Draw(im)
    if draw: draw(d)
    vb=R[src]['vb']
    return crop(im, vb['x']+vb['w']*x0f, vb['y']+vb['h']*y0f, vb['x']+vb['w']*x1f, vb['y']+vb['h']*y1f, name)
def mkbox(d, r, label, col=RED, right=True):
    m2={'x':r['x']-4,'y':r['y']-4,'w':r['w']+8,'h':r['h']+8}
    b=box(d,m2,pad=2,col=col); badge(d, (b[0]+b[2]+8) if right else (b[0]-8), b[1]-6, label, col=col)
strip('h1_click.png','m1', draw=lambda d: mkbox(d,R['m1']['mk'],'2'))
def _m2(d):
    p=R['m2']['prev']; box(d,{'x':p['x']-2,'y':p['y']-2,'w':p['w']+4,'h':p['h']+4},pad=1,col=ORANGE,w=5)
    mkbox(d,R['m2']['mk'],'3')
strip('h2_next.png','m2', draw=_m2)
strip('h3_more.png','m3')
# 色：1［色で自動追跡］
im=Image.open(D+'c1.png').convert('RGB'); d=ImageDraw.Draw(im)
b=box(d,R['c1']['auto']); badge(d, b[0]-6, b[1]+8, '1')
vb=R['c1']['vb']; crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'c1_color.png')
# 色：3 探索半径の円（左半分を拡大）
def _c3(d):
    k=R['c3']['knob']; b=box(d,k,pad=1,col=ORANGE,w=4); badge(d, b[0]+b[2]+34, b[1]+b[3]+30, '3', col=ORANGE, r=22)
strip('c3_radius.png','c3', y0f=0.33, y1f=0.66, x0f=0.02, x1f=0.42, draw=_c3)
# 色：見失った・見つけました
def _c5(d):
    m=R['c5']['msg']; box(d,m,pad=2,col=(120,120,120),w=4)
vb=R['c5']['vb']; im=Image.open(D+'c5.png').convert('RGB'); d=ImageDraw.Draw(im); _c5(d)
crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'c5_lost.png')
im=Image.open(D+'c6.png').convert('RGB'); d=ImageDraw.Draw(im)
b=box(d,R['c6']['msg'],pad=3); badge(d, b[0]-6, b[1]+8, '2')
vb=R['c6']['vb']; crop(im, vb['x'], vb['y'], vb['x']+vb['w'], vb['y']+vb['h'], 'c6_found.png')
print('ok2')
