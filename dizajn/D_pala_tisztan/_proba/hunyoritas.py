"""Hunyorítási próba: minden képernyő GaussianBlur(6)-tal, egymás mellett; plusz áttekintő lap élesen."""
from PIL import Image, ImageFilter
M = "C:/Users/UpgradePC/konyvelo_app/dizajn/D_pala_tisztan/"
nevek = ["01_belepes","02_bekotes","03_fooldal","04_dosszie","05_tetel","06_uzenetek","07_befizetve"]
def lap(blur, cel, skala=0.5):
    kepek = [Image.open(M+n+".png").convert("RGB") for n in nevek]
    if blur: kepek = [k.filter(ImageFilter.GaussianBlur(blur)) for k in kepek]
    w,h = kepek[0].size; w2,h2 = int(w*skala), int(h*skala); res = 24
    out = Image.new("RGB", (len(kepek)*(w2+res)+res, h2+2*res), (244,246,247))
    for i,k in enumerate(kepek): out.paste(k.resize((w2,h2), Image.LANCZOS), (res+i*(w2+res), res))
    out.save(cel); print(cel, out.size)
lap(6, M+"_proba/hunyoritas.png")
lap(0, M+"attekintes.png")
