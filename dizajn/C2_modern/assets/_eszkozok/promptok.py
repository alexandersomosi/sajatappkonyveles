"""Kézjegy C2: a képelemek egységes stílusa és promptjai (2. lépés). A kötegfájlokat a ../_nyers/-be írja.
Használat: python promptok.py <kötegnév> [elem ...]   (pl. python promptok.py k03 meghatalmazas)"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
NYERS = os.path.join(os.path.dirname(HERE), "_nyers")
MODEL = "google/gemini-2.5-flash-image"   # a tulaj választása (11-17), minden elemhez
REF = os.path.join(NYERS, "teszt_gem25_boritek.png")  # stílus-horgony: a jóváhagyott Gemini-boríték

# Egységes stílus: finom toll-tus rajz, EGY tintakék (#1F2F5C) + EGY halvány lavír (#D6E0F0), fehér alapon.
STILUS = ("Spot illustration for a calm private-banking app, drawn as a fine pen-and-ink line drawing like a modern etching. "
  "ONE ink colour only: deep navy ink-blue #1F2F5C, confident clean contour lines of even medium weight, plus sparse fine "
  "parallel hatching only on the shadow sides. ONE pale flat wash #D6E0F0 filling a few areas, slightly offset from the "
  "lines like a risograph print. Background: perfectly flat pure white #FFFFFF, no paper texture, no vignette, no ground "
  "shadow, no frame, no border. The object is centred, drawn at the same scale as the reference image, occupying roughly "
  "40 to 50 percent of the frame width, with generous empty white space around it. Calm, adult, precise, quietly premium. "
  "Strictly no text, no letters, no numbers, no readable writing, no logos, no people, no faces, no hands. Not 3D, not "
  "glossy, no gradients, no drop shadows, not cartoonish, not cute, no sparkles, no other colours. Match the reference "
  "image exactly in line weight, hatching density, wash colour and drawing style; only the subject is different. ")

SPOT = {
 "meghatalmazas": "Subject: a single sheet of document paper lying flat at a slight angle, seen from slightly above. On it only a "
   "few short abstract ruled lines (nothing readable), and near the bottom right a small looping signature flourish on a "
   "short line. A closed fountain pen with its cap on lies diagonally across the lower left corner of the sheet.",
 "videohivas": "Subject: an open laptop seen at a slight three-quarter angle. On its screen a simple video-call window: one "
   "large rounded rectangle containing only a soft pale-wash head-and-shoulders silhouette with no facial features at all, "
   "and below it a short row of three small round buttons. Nothing readable on the screen.",
 "dosszie": "Subject: a closed cardboard document folder (a dossier) seen at a slight angle, with three or four paper sheets "
   "sticking out a little at the top edge, slightly fanned, and one small paper clip on the edge. A simple tab on the folder, empty.",
 "hatarido": "Subject: a simple desk calendar page with a binding ring strip along the top, showing a plain grid of empty "
   "squares (absolutely no numbers or letters). One single square near the lower right is circled by hand with a "
   "confident loose ink loop.",
 "befizetve": "Subject: a sheet of ledger paper seen from slightly above with three short ruled entry lines; the lowest line is "
   "struck through with one single clean straight ink stroke, and a round double-ring rubber-stamp impression with a bold "
   "hand-drawn check mark inside overlaps the lower right corner of the sheet. Nothing readable.",
}

IKON = ("App icon artwork. Full-bleed square canvas completely filled edge to edge with flat deep navy ink-blue #17284A: "
  "no rounded corners, no outer white margin, no border, no frame. Centred, one simple bold mark in off-white #F5F7FA, "
  "occupying about 55 percent of the canvas width, generous padding, a strong silhouette that stays recognisable at 60 "
  "pixels. Flat vector look with smooth confident strokes, calm premium private-bank feel. No gradient, no 3D, no glossy "
  "highlight, no shadow, no texture, no extra decoration, no other colours. ")
IKONOK = {
 "ikon_boritek": "Mark: a closed envelope drawn as a thick rounded outline whose flap forms a V, and one flowing signature "
   "loop that starts at the tip of the flap and sweeps out to the right. No text, no letters.",
 "ikon_pecset": "Mark: a round seal made of one thick circular ring, and inside it a single confident hand-drawn check mark "
   "whose final upstroke continues into a small signature loop. No text, no letters.",
 "ikon_monogram": "Mark: a single capital letter K written as an elegant fountain-pen monogram in one continuous flowing "
   "stroke with natural thick and thin variation, ending in a short underline flourish. Only this one letter, nothing else.",
}

TEXTURA = ("Banknote-style guilloche security pattern covering the whole frame evenly: many very fine thin parallel wavy "
  "lines interlacing in smooth regular sine waves running horizontally from edge to edge, evenly spaced, like the "
  "security background of a bank cheque or a stock certificate. Thin white lines on a perfectly flat deep navy #17284A "
  "background. Uniform density everywhere, no central rosette, no focal point, no border, no frame, no vignette, no "
  "gradient, no text, no numbers, no symbols. Crisp, precise, engraved.")

PORTRE = ("Illustrated avatar placeholder for the user's accountant: head and shoulders of a friendly man in his thirties "
  "with short neat hair, an open-collar shirt under a plain jacket, a calm slight smile, looking at the viewer. Drawn in "
  "the same fine pen-and-ink style as the reference image: deep navy ink-blue #1F2F5C contour lines with sparse fine "
  "hatching, a pale #D6E0F0 wash on the jacket, and a plain round pale #D6E0F0 wash disc behind the head and shoulders. "
  "Clearly a stylised editorial illustration, like an engraved portrait in a modern magazine: not a photo, not a real or "
  "famous person, not a caricature, not cartoon, not cute. Centred, the head and shoulders fill the disc like a passport "
  "photo. Everything outside the disc is perfectly flat pure white #FFFFFF. No text, no letters, no logos, no other colours.")

def koteg(nev, elemek):
    jobs = []
    for e in elemek:
        tag, ver = (e.split(":") + ["v1"])[:2]
        if tag in SPOT:
            jobs.append({"nev": f"spot_{tag}_{ver}", "model": MODEL, "prompt": STILUS + SPOT[tag], "aspect_ratio": "4:3", "ref": REF})
        elif tag in IKONOK:
            jobs.append({"nev": f"{tag}_{ver}", "model": MODEL, "prompt": IKON + IKONOK[tag], "aspect_ratio": "1:1"})
        elif tag == "textura":
            jobs.append({"nev": f"textura_guilloche_{ver}", "model": MODEL, "prompt": TEXTURA, "aspect_ratio": "16:9"})
        elif tag == "portre":
            jobs.append({"nev": f"portre_konyvelo_{ver}", "model": MODEL, "prompt": PORTRE, "aspect_ratio": "1:1", "ref": REF})
        else:
            raise SystemExit("ismeretlen elem: " + tag)
    p = os.path.join(NYERS, nev + ".json")
    json.dump(jobs, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(p)

if __name__ == "__main__":
    koteg(sys.argv[1], sys.argv[2:])
