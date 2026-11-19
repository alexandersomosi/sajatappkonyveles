"""Kézjegy C2: a tulaj kérése (11-17): „Egy képen generáld, hogy a dizájn egységes legyen.”
Ezért minden elemcsoport EGY lapon (egy Gemini-képen) készül, és utána PIL-lel vágjuk szét (lapvago.py).
Használat: python lapok.py <kötegnév> <lap>[:verzió] ...   pl.  python lapok.py k05 illusztraciok
Lapok: illusztraciok (3x2, 6 rajz), ikonok (2x2, 4 ikonterv), egyeb (2 arckép-helyőrző + guilloche minta),
       egyedi_<sor>_<oszlop> (egy rajz nagyobb felbontásban, a mesterlap a referencia)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
NYERS = os.path.join(ASSETS, "_nyers")
MODEL = "google/gemini-2.5-flash-image"   # a tulaj választása (11-17), minden elemhez
REF_BORITEK = os.path.join(NYERS, "teszt_gem25_boritek.png")   # a tulaj által látott Gemini-boríték
LAP_ILL = os.path.join(ASSETS, "_lap_illusztraciok.png")        # mesterlap (a vágás és az egyedi rajzok forrása)

# Egységes stílus (2. lépés): finom toll-tus rajz, EGY tintakék (#1F2F5C) + EGY halvány lavír (#D6E0F0), fehér alapon.
STILUS = ("All drawn by the same hand in exactly the same style, matching the drawing style of the reference image: a fine "
  "pen-and-ink line drawing like a modern etching. ONE ink colour only, deep navy ink-blue #1F2F5C: confident clean contour "
  "lines of one even medium weight, plus sparse fine parallel hatching only on the shadow sides. ONE pale flat wash, light "
  "blue-grey #D6E0F0, filling a few areas of each object, slightly offset from the lines like a risograph print. The same "
  "light direction (from the upper left) and the same slight three-quarter viewing angle for every object. Calm, adult, "
  "precise, quietly premium, like the stationery of a private bank. ")
TILTAS = ("Strictly no text, no letters, no numbers, no digits, no readable writing, no logos, no people, no faces, no hands. "
  "Not 3D, not glossy, no gradients, no drop shadows, not cartoonish, not cute, no sparkles, no colours other than the navy "
  "ink and the one pale blue-grey wash.")

TARGY = {
 (1, 1): "an opened paper envelope with a folded letter sheet half pulled out of it; on the letter only two short wavy pen "
         "lines and a small signature-like flourish, nothing readable",
 (1, 2): "a single sheet of document paper lying at a slight angle with a few short abstract ruled lines and a small looping "
         "signature flourish on a short line near its bottom right; a closed fountain pen with its cap on lies diagonally "
         "across the lower left corner of the sheet",
 (1, 3): "an open laptop at a slight three-quarter angle; on its screen a simple video-call window: one large rounded "
         "rectangle with a soft pale-wash head-and-shoulders silhouette without any facial features, and a short row of "
         "three small round buttons below it",
 (2, 1): "a closed cardboard document folder (a dossier) with three or four paper sheets slightly fanned out at its top "
         "edge and one small paper clip; a simple empty tab on the folder",
 (2, 2): "a desk calendar page with a binding ring strip along the top and a plain grid of empty squares without any "
         "numbers; one square near the lower right is circled by hand with one loose confident ink loop",
 (2, 3): "a sheet of ledger paper with three short ruled entry lines, the lowest one struck through with one clean straight "
         "ink stroke, and a round double-ring stamp impression with a bold hand-drawn check mark inside overlapping the "
         "lower right corner of the sheet",
}
HELY = {(1, 1): "Top row, left", (1, 2): "Top row, middle", (1, 3): "Top row, right",
        (2, 1): "Bottom row, left", (2, 2): "Bottom row, middle", (2, 3): "Bottom row, right"}

LAP_ILLUSZTRACIOK = ("One single presentation sheet showing a matching set of SIX spot illustrations for a calm private-banking "
  "app, arranged in a perfectly even grid of 3 columns and 2 rows. Background: perfectly flat pure white #FFFFFF everywhere, "
  "no paper texture, no vignette. Each illustration sits centred in its own invisible cell; all six are drawn at the same "
  "scale and the same visual size (each object about 55 to 60 percent of its cell width), with wide empty white gaps between "
  "them so that no two drawings touch or overlap. No grid lines, no cell borders, no frames, no captions, no labels. "
  + STILUS + " ".join(f"{HELY[k]}: {v}." for k, v in TARGY.items()) + " " + TILTAS)

LAP_IKONOK = ("One single presentation sheet showing FOUR app-icon concepts for the same calm private-banking app, arranged in "
  "an even grid of 2 columns and 2 rows on a perfectly flat pure white #FFFFFF background, with wide white gaps between them. "
  "Each concept is one identical rounded-square app-icon tile (iOS squircle shape, all four exactly the same size, each about "
  "36 percent of the sheet width), filled with flat deep navy ink-blue #17284A, no border, no shadow under the tile. Inside "
  "each tile one simple bold mark in off-white #F5F7FA, centred, occupying about 55 percent of the tile, with generous "
  "padding: a strong silhouette that stays recognisable at 60 pixels. All four marks share the same stroke weight and the "
  "same smooth, confident fountain-pen line quality, as one family. Flat vector look: no gradient, no 3D, no glossy "
  "highlight, no inner shadow, no texture, no other colours, no captions or labels under the tiles. "
  "Top left: a fountain-pen nib pointing down-left, its tip finishing one short looping signature stroke. "
  "Top right: a closed envelope drawn as a thick rounded outline whose flap forms a V, with one flowing signature loop "
  "sweeping out from the tip of the flap to the right. "
  "Bottom left: a round seal made of one thick circular ring, inside it a single hand-drawn check mark whose final upstroke "
  "continues into a small signature loop. "
  "Bottom right: a single capital letter K written as an elegant fountain-pen monogram in one continuous flowing stroke with "
  "natural thick-and-thin variation, ending in a short underline flourish. This one letter K is the only letter on the "
  "whole sheet; no other text, no numbers, no logos.")

# v2 (11-17): a v1-en a toll és a K hajszálvékony volt (60 pt-on eltűnt), a csempe zöldes lett, a jelek krémszínűek.
LAP_IKONOK_V2 = ("One single presentation sheet showing FOUR app-icon concepts for the same calm private-banking app, arranged "
  "in an even grid of 2 columns and 2 rows on a perfectly flat pure white #FFFFFF background, with wide white gaps between "
  "them. Each concept is one identical rounded-square app-icon tile (iOS squircle shape, all four exactly the same size, "
  "each about 38 percent of the sheet width), filled with flat deep ink-blue #17284A (a clear blue navy, not teal, not "
  "green, not black), no border, no shadow under the tile. Inside each tile one simple bold mark in cool off-white #F5F7FA "
  "(not cream, not yellow), centred, occupying about 60 percent of the tile, with generous padding. Every mark is drawn "
  "with ONE uniform bold stroke, about 7 percent of the tile width, with rounded ends, like a thick felt-tip pen: no "
  "hairlines, no thin flourishes, so that each mark stays clearly recognisable at 29 pixels. All four marks share exactly "
  "the same stroke weight, as one family. Flat vector look: no gradient, no 3D, no glossy highlight, no inner shadow, no "
  "texture, no other colours, no captions or labels under the tiles. "
  "Top left: a bold fountain-pen nib seen from the front (only the nib, no pen barrel), pointing down, with its slit and "
  "breather hole cut out as negative space, and under its tip one bold looping signature stroke. "
  "Top right: a closed envelope drawn as a bold rounded outline whose flap forms a V, with one bold signature loop sweeping "
  "out from the tip of the flap to the right. "
  "Bottom left: a round seal made of one bold clean circular ring, inside it a single bold check mark whose final upstroke "
  "continues past the ring into a small signature loop. "
  "Bottom right: a single capital letter K written as a fountain-pen monogram in one continuous bold flowing stroke, "
  "ending in a bold underline flourish. This one letter K is the only letter on the whole sheet; no other text, no "
  "numbers, no logos.")

# v3 (11-17): a v2-n a borítékon és a pecséten az aláírás-hurok „al” betűkként olvasható, a pecsét viaszos-hullámos lett.
LAP_IKONOK_V3 = ("One single presentation sheet showing FOUR app-icon concepts for the same calm private-banking app, arranged "
  "in an even grid of 2 columns and 2 rows on a perfectly flat pure white #FFFFFF background, with wide white gaps between "
  "them. Each concept is one identical rounded-square app-icon tile (iOS squircle shape, all four exactly the same size, "
  "each about 38 percent of the sheet width), filled with flat deep ink-blue #17284A (a clear blue navy, not teal, not "
  "green, not black), no border, no shadow under the tile. Inside each tile one simple bold mark in cool off-white #F5F7FA "
  "(not cream, not yellow), centred, occupying about 60 percent of the tile, with generous padding. Every mark is drawn "
  "with ONE uniform bold stroke, about 7 percent of the tile width, with rounded ends, like a thick felt-tip pen: no "
  "hairlines, no thin flourishes, no small scribbles, so that each mark stays clearly recognisable at 29 pixels. All four "
  "marks share exactly the same stroke weight, as one family. Flat vector look: no gradient, no 3D, no glossy highlight, "
  "no inner shadow, no texture, no other colours, no captions or labels under the tiles. "
  "Top left: a bold fountain-pen nib seen from the front (only the nib, no pen barrel), pointing down, with its slit and "
  "breather hole cut out as negative space, and under its tip one single bold smooth wave stroke drawn by the nib. "
  "Top right: a closed envelope drawn as a bold rounded outline whose flap forms a V, with one small solid round seal "
  "dot where the tip of the V meets; nothing else, no scribble. "
  "Bottom left: a round seal made of one bold perfectly round clean circular ring (not a wax seal, no wavy edge), inside "
  "it a single bold check mark. "
  "Bottom right: a single capital letter K written as a fountain-pen monogram in one continuous bold flowing stroke, "
  "ending in a bold underline flourish. This one letter K is the only letter on the whole sheet; no other letters, no "
  "text, no numbers, no logos, no signatures.")

LAP_EGYEB = ("One single presentation sheet on a perfectly flat pure white #FFFFFF background with three items side by side in "
  "one row, evenly spaced with wide white gaps, each item about 28 percent of the sheet width, no captions or labels. "
  "Left and middle: two illustrated avatar placeholders for the user's accountant, drawn in exactly the same pen-and-ink "
  "style as the reference sheet: deep navy ink-blue #1F2F5C contour lines of one even medium weight, sparse fine hatching on "
  "the shadow sides, one pale #D6E0F0 flat wash. Each is a head-and-shoulders bust centred inside a plain round disc of flat "
  "pale #D6E0F0 wash, filling the disc like a passport photo, the shoulders cut off by the lower edge of the disc. Left: a "
  "friendly man in his thirties with short neat hair, an open-collar shirt under a plain jacket. Middle: a friendly woman in "
  "her thirties with shoulder-length hair tied back, a plain blouse under a plain jacket. Both with calm, slightly smiling, "
  "simplified features, looking at the viewer. Clearly stylised editorial illustrations like engraved portraits in a modern "
  "magazine: not photos, not any real or famous person, not caricatures, not cartoon, not cute. "
  "Right: a square swatch of a banknote-style guilloche security pattern: the square is filled edge to edge with flat deep "
  "navy #17284A and evenly covered with many very fine thin pale lines interlacing in smooth regular sine waves that run "
  "horizontally from edge to edge, evenly spaced, like the security background of a bank cheque. Uniform density, no "
  "central rosette, no focal point, no border, no frame, crisp and engraved. "
  "No text, no letters, no numbers, no logos anywhere, no colours other than the navy ink, the pale blue-grey wash and white.")

def egyedi(sor, osz):
    return ("The reference image is a sheet of six spot illustrations in a 3 by 2 grid. Redraw ONLY the object in the "
      f"{HELY[(sor, osz)].lower()} cell of that sheet ({TARGY[(sor, osz)]}), as one single spot illustration, keeping it "
      "identical to the reference: the same object, the same composition, the same viewing angle, the same navy ink-blue "
      "#1F2F5C line weight relative to the object, the same sparse hatching and the same pale #D6E0F0 wash areas. Do not "
      "invent a new style and do not add anything. Draw it larger and crisper: the object centred and filling about 75 "
      "percent of the frame width, on a perfectly flat pure white #FFFFFF background with no paper texture, no vignette, no "
      "ground shadow, no frame. " + TILTAS)

def koteg(nev, elemek):
    jobs = []
    for e in elemek:
        tag, ver = (e.split(":") + ["v1"])[:2]
        if tag == "illusztraciok":
            jobs.append({"nev": f"lap_illusztraciok_{ver}", "model": MODEL, "prompt": LAP_ILLUSZTRACIOK,
                         "aspect_ratio": "3:2", "ref": REF_BORITEK})
        elif tag == "ikonok":
            jobs.append({"nev": f"lap_ikonok_{ver}", "model": MODEL, "aspect_ratio": "1:1",
                         "prompt": {"v1": LAP_IKONOK, "v2": LAP_IKONOK_V2}.get(ver, LAP_IKONOK_V3)})
        elif tag == "egyeb":
            jobs.append({"nev": f"lap_egyeb_{ver}", "model": MODEL, "prompt": LAP_EGYEB, "aspect_ratio": "16:9",
                         "ref": LAP_ILL})
        elif tag.startswith("egyedi_"):
            _, s, o = tag.split("_")
            jobs.append({"nev": f"egyedi_{s}{o}_{ver}", "model": MODEL, "prompt": egyedi(int(s), int(o)),
                         "aspect_ratio": "4:3", "ref": LAP_ILL})
        else:
            raise SystemExit("ismeretlen lap: " + tag)
    p = os.path.join(NYERS, nev + ".json")
    json.dump(jobs, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(p)

if __name__ == "__main__":
    koteg(sys.argv[1], sys.argv[2:])
