# Áttekintő lap: a képernyők egymás mellett, alattuk a hunyorítás-próba (GaussianBlur 6).
from PIL import Image, ImageFilter
M = "C:/Users/UpgradePC/konyvelo_app/dizajn/B_szilva_rendben/"
N = ["01_belepes", "02_bekotes", "03_fooldal", "04_dosszie", "05_tetel", "06_uzenetek", "07_beadott_tetel"]
W, H, G = 390, 844, 24
lap = Image.new("RGB", (G + len(N) * (W + G), G + 2 * (H + G)), (246, 244, 247))
for i, n in enumerate(N):
    im = Image.open(M + n + ".png").convert("RGB")
    bl = im.filter(ImageFilter.GaussianBlur(6))
    x = G + i * (W + G)
    lap.paste(im.resize((W, H), Image.LANCZOS), (x, G))
    lap.paste(bl.resize((W, H), Image.LANCZOS), (x, G + H + G))
lap.save(M + "_attekintes.png")
print(lap.size)
