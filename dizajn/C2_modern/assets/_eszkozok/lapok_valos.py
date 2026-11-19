"""Kézjegy C2, 3. stíluskör (11-17 este). A tulaj a vonalrajzokra: „Ez túl mesefigurás”, majd: „Ilyen modern legyen és
igazinak nézzen ki” (Revolut/Qonto). Ezért NINCS vonalrajz: valósághű, modern tárgy-renderek (valódi anyagok, lágy
stúdiófény, természetes árnyék), mind a hat EGY lapon, azonos fénnyel, kameraszöggel és anyagkezeléssel.
Arc, ember, felirat, logó sehol. A régi vonalrajzos promptok a lapok.py-ben maradnak (nem töröljük).
Használat: python lapok_valos.py <kötegnév> <lap>[:verzió] ...
Lapok: illusztraciok (3x2), ikonok (2x2), egyeb (guilloche + papírszál-minta), egyedi_<sor><oszlop> (egy tárgy
nagyobban, a mesterlap a referencia)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
NYERS = os.path.join(ASSETS, "_nyers")
MODEL = "google/gemini-2.5-flash-image"   # a tulaj választása (11-17), minden elemhez
LAP_ILL = os.path.join(ASSETS, "_lap_illusztraciok.png")

# tokens.css: --tintakek #17284A, --gomb-m-alap #D6E0F0, --tollkek #2546A6 (csak tintanyom), --lap #FFFFFF
PALETTA = ("Restrained palette only: deep ink-blue #17284A (a clear dark blue navy, not purple, not black), clean cool paper "
  "white, pale blue-grey #D6E0F0, satin silver, and fountain-pen blue #2546A6 used only for the few ink marks. ")
ANYAG = ("Real materials rendered with true physical detail: thick uncoated cotton paper with a visible fine fibre and "
  "slightly soft edges, matte bead-blasted aluminium, matte soft-touch lacquer, smooth heavy coloured board. ")
FENY = ("The same camera for every object (a slightly elevated three-quarter view from about 30 degrees above, from the "
  "front left, a moderate telephoto lens with no wide-angle distortion), the same soft diffused studio light from one large "
  "softbox at the upper left, and the same soft natural contact shadow falling short towards the lower right beneath each "
  "object. ")
TILTAS = ("Strictly no text, no letters, no numbers, no digits, no readable writing, no logos or brand marks, no people, no "
  "faces, no hands. No glossy plastic, no cartoon proportions, no toy-like look, no clay render, no isometric icon style, "
  "no outlines, no neon, no glow, no sparkles, no bright saturated colours, no colours other than the listed palette.")

TARGY = {
 (1, 1): "an opened envelope of heavy deep ink-blue paper lying almost flat with its flap open, and a folded sheet of white "
         "cotton letter paper half pulled out of it; the letter is blank",
 (1, 2): "a single sheet of thick white cotton paper lying flat at a slight angle, with a closed matte ink-blue fountain pen "
         "with a satin silver clip lying diagonally across its lower left corner; on the paper only a few very faint pale "
         "blue-grey bars where the lines of a form would be, and near the bottom right one short smooth fountain-pen-blue "
         "ink swoosh like a signature, but not letters",
 (1, 3): "a slim matte silver aluminium laptop, open, in three-quarter view; its screen glows softly with an abstract "
         "video-call layout: a pale blue-grey background, one large rounded rectangle tile in a soft blue gradient and a "
         "short row of three small round buttons below it; no person, no face, no text on the screen",
 (2, 1): "a closed document folder of smooth deep ink-blue board lying flat, with three or four white paper sheets sticking "
         "out a little at its top edge, and one pale blue-grey elastic band around it",
 (2, 2): "a small standing easel desk calendar with a white wire binding along the top; its top page is white paper with a "
         "clean grid of empty squares drawn in faint pale blue-grey lines, and one single square near the lower right is "
         "filled solid ink-blue; absolutely no numbers, no month name, no letters",
 (2, 3): "a small white paper slip lying flat with a round ink-blue rubber-stamp impression on it, showing only a bold check "
         "mark inside a clean double ring (no words in the stamp), and right beside it a compact matte ink-blue desk stamp "
         "standing upright",
}
HELY = {(1, 1): "Top row, left", (1, 2): "Top row, middle", (1, 3): "Top row, right",
        (2, 1): "Bottom row, left", (2, 2): "Bottom row, middle", (2, 3): "Bottom row, right"}

LAP_ILLUSZTRACIOK = ("A photorealistic product-render presentation sheet showing SIX separate everyday desk objects arranged in a "
  "perfectly even grid of 3 columns and 2 rows: the empty-state visuals of a calm, premium banking app, in the style of the "
  "modern 3D object visuals of Revolut and Qonto. Background: one seamless pure white #FFFFFF studio sweep, completely flat, "
  "no horizon line, no vignette, no gradient, no table surface. Every object stands alone in its own invisible cell, "
  "centred, all six at the same scale and the same visual size (each about 50 percent of its cell width), with wide empty "
  "white space between them so that no two objects or shadows touch. One photographed set with identical treatment: "
  + FENY + ANYAG + PALETTA + " ".join(f"{HELY[k]}: {v}." for k, v in TARGY.items()) + " " + TILTAS)

# v2: a v1-en a levél alig látszik ki a borítékból, az aláírás „an” betűknek olvasható, a tárgyak kicsik (a cella ~45%-a),
# a fény lapos (CG-hatás). A v2 nagyobb tárgyakat, kihúzott levelet, betű-mentes tintavonalat, fotószerűbb fényt kér.
TARGY_V2 = dict(TARGY)
TARGY_V2[(1, 1)] = ("an opened envelope of heavy deep ink-blue paper lying almost flat with its flap open, and a folded sheet "
  "of white cotton letter paper pulled halfway out of it, so that the upper half of the white letter clearly rises above the "
  "envelope; the letter is blank")
TARGY_V2[(1, 2)] = ("a single sheet of thick white cotton paper lying flat at a slight angle, with a closed matte ink-blue "
  "fountain pen with a satin silver clip lying diagonally across its lower left corner; on the paper only a few very faint "
  "pale blue-grey bars where the lines of a form would be, and near the bottom right one single short gentle wave line of "
  "fountain-pen-blue ink, one smooth curve that is clearly not a letter")
TARGY_V2[(2, 1)] = ("a closed document folder of smooth deep ink-blue board lying flat, with the top edges of three or four "
  "white paper sheets clearly sticking out of it, slightly fanned, and one pale blue-grey elastic band around it")
FENY_V2 = ("All six seen from exactly the same camera angle: a slightly elevated three-quarter view from about 30 degrees "
  "above, from the front left, a moderate telephoto lens with no wide-angle distortion. The same soft but directional studio "
  "light from one large softbox at the upper left, giving gentle tonal gradients across every surface, subtle ambient "
  "occlusion in the folds and a soft natural contact shadow falling towards the lower right beneath each object, like a "
  "high-end product photograph, not a flat 3D render. ")
LAP_ILLUSZTRACIOK_V2 = ("A photorealistic product-photography presentation sheet showing SIX separate everyday desk objects "
  "arranged in a perfectly even grid of 3 columns and 2 rows: the empty-state visuals of a calm, premium banking app, in "
  "the style of the modern realistic object visuals of Revolut and Qonto. Background: one seamless pure white #FFFFFF "
  "studio sweep, completely flat, no horizon line, no vignette, no gradient, no table surface. Every object stands alone in "
  "its own invisible cell, centred, all six at the same scale and the same visual size (each about 62 percent of its cell "
  "width), with clear empty white space between them so that no two objects or shadows touch. One photographed set with "
  "identical treatment: " + FENY_V2 + ANYAG + PALETTA
  + " ".join(f"{HELY[k]}: {v}." for k, v in TARGY_V2.items()) + " " + TILTAS)

# 4. kör (11-17 este): a tulaj a valos_lap_illusztraciok_v1-re: „Ezek jók, de nem szemből kéne mutatni őket?”
# Ugyanaz a hat tárgy, anyag, fény és paletta, de SZEMBŐL, szemmagasságból (legfeljebb 10-15 fokos elfordítás),
# a tárgyak állnak és felénk néznek, alattuk lágy érintkezési árnyék.
TARGY_SZ = {
 (1, 1): ("an envelope of heavy deep ink-blue paper standing upright on its long bottom edge and facing the viewer, its "
          "flap folded open upwards behind it, with a folded sheet of white cotton letter paper standing up out of it, so "
          "that the upper half of the blank white letter clearly rises above the envelope"),
 (1, 2): ("a single sheet of thick white cotton paper in portrait orientation standing upright and facing the viewer, very "
          "slightly curved so that it stands on its own; on it only a few very faint pale blue-grey bars where the lines of "
          "a form would be, and near its bottom right one single short gentle wave line of fountain-pen-blue ink, one smooth "
          "curve that is clearly not a letter; in front of the paper a closed matte ink-blue fountain pen with a satin "
          "silver clip lies on the floor, parallel to the bottom edge of the sheet"),
 (1, 3): ("a slim matte silver aluminium laptop, open, seen from the front with its screen facing the viewer straight on, "
          "the keyboard deck visible only as a thin foreshortened strip below the screen; the screen glows softly with an "
          "abstract video-call layout: a pale blue-grey background, one large rounded rectangle tile in a soft blue "
          "gradient and a short row of three small round buttons below it; no person, no face, no text on the screen"),
 (2, 1): ("a closed document folder of smooth deep ink-blue board standing upright on its bottom edge and facing the "
          "viewer, with the top edges of three or four white paper sheets clearly sticking out of its top, slightly fanned, "
          "and one pale blue-grey elastic band running vertically around it"),
 (2, 2): ("a small standing easel desk calendar facing the viewer straight on, with a white wire binding along the top; its "
          "front page is white paper with a clean grid of empty squares drawn in faint pale blue-grey lines, and one single "
          "square near the lower right is filled solid ink-blue; absolutely no numbers, no month name, no letters"),
 (2, 3): ("a small white paper card standing upright and facing the viewer, with one round ink-blue rubber-stamp impression "
          "on its right half showing only a bold check mark inside a clean double ring (no words in the stamp); in front of "
          "the card, slightly to the left so that the impression stays fully visible, a compact matte ink-blue desk stamp "
          "standing upright on the floor"),
}
FENY_SZ = ("All six photographed from exactly the same camera position: straight from the front at eye level, the camera "
  "level with the middle of the objects, looking straight at their front faces. Every object faces the viewer, turned at "
  "most 10 to 15 degrees to the left so that its depth and side edge still read as a real three-dimensional object. A "
  "moderate telephoto lens with no wide-angle distortion. NOT a top-down view, NOT an isometric view, NOT seen from above, "
  "NOT lying flat. The same soft but directional studio light from one large softbox at the upper left, giving gentle "
  "tonal gradients across every surface and subtle ambient occlusion in the folds, and the same soft natural contact shadow "
  "on the invisible white floor directly beneath each object, fading out towards the lower right, like a high-end product "
  "photograph, not a flat 3D render. ")
LAP_ILLUSZTRACIOK_SZEMBOL = ("A photorealistic product-photography presentation sheet showing SIX separate everyday desk "
  "objects arranged in a perfectly even grid of 3 columns and 2 rows: the empty-state visuals of a calm, premium banking "
  "app, in the style of the modern realistic object visuals of Revolut and Qonto. Background: one seamless pure white "
  "#FFFFFF studio sweep, completely flat, no horizon line, no vignette, no gradient, no visible table edge. Every object "
  "stands alone in its own invisible cell, centred, all six at the same scale and the same visual size (each about 60 "
  "percent of its cell width and height), all standing on the same invisible floor line within their row, with clear empty "
  "white space between them so that no two objects or shadows touch. One photographed set with identical treatment: "
  + FENY_SZ + ANYAG + PALETTA + " ".join(f"{HELY[k]}: {v}." for k, v in TARGY_SZ.items()) + " " + TILTAS
  .replace("no isometric icon style, ", "no isometric view, no top-down view, "))

# Ikonlap szemből: a csempék egyenesen a kamerának, valódi anyag (pamutkarton, dombornyomás, fóliázás).
LAP_IKONOK_SZEMBOL = ("One single presentation sheet showing FOUR app-icon concepts for the same calm, premium banking app, "
  "in an even grid of 2 columns and 2 rows on a perfectly flat pure white #FFFFFF background with wide white gaps between "
  "them. Each concept is one identical rounded-square app-icon tile (iOS squircle shape, all four exactly the same size, "
  "each about 38 percent of the sheet width), photographed exactly straight from the front, flat and parallel to the "
  "camera, no perspective, no tilt, no drop shadow outside the tile. Each tile is a real material in deep ink-blue #17284A "
  "(a clear dark blue navy, not teal, not purple, not black): fine matte cotton board with a barely visible fibre, lit by "
  "soft diffused light from the upper left, so that the relief of the mark reads through subtle highlights on its upper "
  "left edges and soft shadows on its lower right edges, like premium letterpress stationery. Inside each tile one simple "
  "bold mark, centred, about 55 percent of the tile, with generous padding, a strong silhouette that stays recognisable at "
  "60 pixels. All four marks are one family: the same depth of relief, the same light, the same cool pale-silver foil "
  "#E6ECF5 where foil is used. "
  "Top left: a bold geometric capital letter K monogram in a clean modern sans-serif shape (not calligraphic), debossed into "
  "the ink-blue board and filled with pale-silver foil, crisp bevelled edges catching the light. "
  "Top right: one single smooth continuous signature stroke, a bold flowing swoosh that is NOT a letter, hot-foil stamped "
  "in pale-silver foil into the ink-blue board. "
  "Bottom left: a round seal disc of pale blue-grey #D6E0F0 cotton paper slightly raised from the tile, with a finely ribbed "
  "embossed outer edge and one bold check mark debossed in its centre. "
  "Bottom right: the back of an ink-blue envelope filling the tile, the V-shaped flap seam pressed in as a soft crease, and "
  "at the tip of the V one small round pale-silver foil seal dot. "
  "The letter K is the only letter on the whole sheet: no other letters, no text, no numbers, no captions, no labels, no "
  "logos, no people, no faces. No gloss, no plastic, no 3D tilt, no glow, no colours other than ink-blue, pale-silver and "
  "pale blue-grey.")

# v2: a v1-en az aláírás-csempe vékony és „rw” betűknek olvasható, a pecsét hullámos szélű viaszpecsét (kitűző-hatás).
# Az EGÉSZ lap újra: vastag, betű-mentes vonás; kerek, recézett szélű (érme-szerű) pecsét.
LAP_IKONOK_SZEMBOL_V2 = (LAP_IKONOK_SZEMBOL
  .replace("Top right: one single smooth continuous signature stroke, a bold flowing swoosh that is NOT a letter, hot-foil "
           "stamped in pale-silver foil into the ink-blue board. ",
           "Top right: one bold abstract pen flourish, hot-foil stamped in pale-silver foil into the ink-blue board: a single "
           "thick continuous stroke of uniform heavy weight (about 8 percent of the tile width, as heavy as the strokes of "
           "the K) that sweeps up from the lower left in one wide smooth arc, crosses back over itself in ONE single large "
           "open loop, and finishes in a long straight underline to the right. No thin hairlines, no small wiggles, no "
           "peaks: it must not look like any letter or word. ")
  .replace("Bottom left: a round seal disc of pale blue-grey #D6E0F0 cotton paper slightly raised from the tile, with a "
           "finely ribbed embossed outer edge and one bold check mark debossed in its centre. ",
           "Bottom left: a perfectly circular seal disc of pale blue-grey #D6E0F0 cotton paper slightly raised from the "
           "tile, with a crisp finely milled coin-like edge (a perfect circle, NOT a wavy wax seal, NOT a scalloped badge), "
           "and one bold check mark debossed in its centre. "))
assert LAP_IKONOK_SZEMBOL_V2 != LAP_IKONOK_SZEMBOL and LAP_IKONOK_SZEMBOL_V2.count("milled") == 1
# v3: a v2 hurkos vonása „£” jelnek / betűnek olvasható, a csempék kisebbek lettek (33%). Az EGÉSZ lap újra:
# hurok és keresztezés nélküli, egyetlen hullám-vonás; csempe ~40%.
LAP_IKONOK_SZEMBOL_V3 = (LAP_IKONOK_SZEMBOL_V2
  .replace("each about 38 percent of the sheet width", "each about 41 percent of the sheet width, with narrower white gaps")
  .replace("that sweeps up from the lower left in one wide smooth arc, crosses back over itself in ONE single large "
           "open loop, and finishes in a long straight underline to the right. No thin hairlines, no small wiggles, no "
           "peaks: it must not look like any letter or word. ",
           "that runs horizontally across the middle of the tile from left to right as ONE gentle smooth wave: it rises "
           "once into a soft crest, falls once into a soft trough, and ends in a short straight tapered tail, like the "
           "single final stroke of a signature. NO loops, NO crossings, NO hairlines, NO small wiggles: it must not look "
           "like any letter, number, currency sign or word. "))
assert LAP_IKONOK_SZEMBOL_V3.count("ONE gentle smooth wave") == 1 and "41 percent" in LAP_IKONOK_SZEMBOL_V3

def egyedi_szembol(sor, osz):
    return ("The reference image is a photorealistic sheet of six product-photography objects in a 3 by 2 grid, all seen "
      f"from the front at eye level. Render ONLY the object in the {HELY[(sor, osz)].lower()} cell of that sheet "
      f"({TARGY_SZ[(sor, osz)]}) as one single image, keeping it identical to the reference: the same object, the same "
      "design and proportions, the same materials and colours, the same front eye-level camera angle and the same slight "
      "turn, the same soft studio light from the upper left and the same soft contact shadow beneath it. Do not invent a new "
      "style, do not change the angle and do not add anything. Render it larger and sharper: the object centred and filling "
      "about 70 percent of the frame width, on one seamless pure white #FFFFFF studio background, completely flat, no "
      "horizon line, no vignette. " + TILTAS)

LAP_IKONOK = ("One single presentation sheet showing FOUR app-icon concepts for the same calm, premium banking app, in an even "
  "grid of 2 columns and 2 rows on a perfectly flat pure white #FFFFFF background with wide white gaps between them. Each "
  "concept is one identical rounded-square app-icon tile (iOS squircle shape, all four exactly the same size, each about 38 "
  "percent of the sheet width), seen straight on and flat to the camera, no perspective, no drop shadow outside the tile. "
  "Each tile is a real material in deep ink-blue #17284A (a clear dark blue navy, not teal, not purple, not black): fine "
  "matte cotton board with a barely visible fibre, lit by soft diffused light from the upper left, so that the relief reads "
  "through subtle highlights and soft shadows. Inside each tile one simple bold mark, centred, about 55 percent of the tile, "
  "with generous padding, a strong silhouette that stays recognisable at 60 pixels. All four marks are one family: the same "
  "depth of relief, the same light, the same cool pale-silver foil #E6ECF5 where foil is used. "
  "Top left: a bold capital letter K monogram debossed into the ink-blue board and filled with pale-silver foil, crisp "
  "bevelled edges catching the light. "
  "Top right: one single smooth continuous signature stroke, a bold flowing swoosh that is NOT a letter, hot-foil stamped "
  "in pale-silver foil into the ink-blue board. "
  "Bottom left: a round seal disc of pale blue-grey #D6E0F0 cotton paper slightly raised from the tile, with a finely ribbed "
  "embossed outer edge and one bold check mark debossed in its centre. "
  "Bottom right: the back of an ink-blue envelope filling the tile, the V-shaped flap seam pressed in as a soft crease, and "
  "at the tip of the V one small round pale-silver foil seal dot. "
  "The letter K is the only letter on the whole sheet: no other letters, no text, no numbers, no captions, no labels, no "
  "logos. No gloss, no plastic, no 3D tilt, no glow, no colours other than ink-blue, pale-silver and pale blue-grey.")

LAP_EGYEB = ("One single presentation sheet on a perfectly flat pure white #FFFFFF background with exactly two square material "
  "swatches side by side in one row, the same size (each about 44 percent of the sheet width), evenly spaced with a wide "
  "white gap, seen straight on and flat, no perspective, no shadow, no frame, no captions. "
  "Left swatch: a banknote-style guilloche security pattern printed on deep ink-blue #17284A paper: the square is filled edge "
  "to edge with flat ink-blue and evenly covered by many very fine thin lines in a slightly lighter dusty blue #3A5185 that "
  "interlace in smooth regular sine waves running horizontally from edge to edge, evenly spaced, like the engraved security "
  "background of a bank cheque. Uniform density across the whole square, no central rosette, no focal point, no border. "
  "Right swatch: a flat macro photograph of premium white cotton writing paper, evenly lit with soft light, filling the "
  "square edge to edge: a uniform cool white surface with a very fine visible fibre and a subtle felt texture, no folds, "
  "no shadows, no stains, no watermark, no vignette. "
  "No text, no letters, no numbers, no logos anywhere, no colours other than ink-blue, dusty blue and paper white.")

def egyedi(sor, osz):
    return ("The reference image is a photorealistic sheet of six product-render objects in a 3 by 2 grid. Render ONLY the "
      f"object in the {HELY[(sor, osz)].lower()} cell of that sheet ({TARGY[(sor, osz)]}) as one single image, keeping it "
      "identical to the reference: the same object, the same design and proportions, the same materials and colours, the "
      "same camera angle, the same soft studio light from the upper left and the same soft contact shadow towards the lower "
      "right. Do not invent a new style and do not add anything. Render it larger and sharper: the object centred and "
      "filling about 72 percent of the frame width, on one seamless pure white #FFFFFF studio background, completely flat, "
      "no horizon line, no vignette. " + TILTAS)

def koteg(nev, elemek):
    jobs = []
    for e in elemek:
        tag, ver = (e.split(":") + ["v1"])[:2]
        if tag == "illusztraciok":
            jobs.append({"nev": f"valos_lap_illusztraciok_{ver}", "model": MODEL, "aspect_ratio": "3:2",
                         "prompt": LAP_ILLUSZTRACIOK if ver == "v1" else LAP_ILLUSZTRACIOK_V2})
        elif tag == "szembol":
            jobs.append({"nev": f"valos_szembol_{ver}", "model": MODEL, "aspect_ratio": "3:2",
                         "prompt": LAP_ILLUSZTRACIOK_SZEMBOL})
        elif tag == "ikonok_szembol":
            jobs.append({"nev": f"valos_lap_ikonok_szembol_{ver}", "model": MODEL, "aspect_ratio": "1:1",
                         "prompt": {"v1": LAP_IKONOK_SZEMBOL, "v2": LAP_IKONOK_SZEMBOL_V2}.get(ver, LAP_IKONOK_SZEMBOL_V3)})
        elif tag.startswith("szembol_"):
            so = tag.split("_")[1]
            jobs.append({"nev": f"valos_szembol_egyedi_{so}_{ver}", "model": MODEL,
                         "prompt": egyedi_szembol(int(so[0]), int(so[1])), "aspect_ratio": "1:1", "ref": LAP_ILL})
        elif tag == "ikonok":
            jobs.append({"nev": f"valos_lap_ikonok_{ver}", "model": MODEL, "prompt": LAP_IKONOK, "aspect_ratio": "1:1"})
        elif tag == "egyeb":
            jobs.append({"nev": f"valos_lap_egyeb_{ver}", "model": MODEL, "prompt": LAP_EGYEB, "aspect_ratio": "16:9"})
        elif tag.startswith("egyedi_"):
            so = tag.split("_")[1]
            jobs.append({"nev": f"valos_egyedi_{so}_{ver}", "model": MODEL, "prompt": egyedi(int(so[0]), int(so[1])),
                         "aspect_ratio": "1:1", "ref": LAP_ILL})
        else:
            raise SystemExit("ismeretlen lap: " + tag)
    p = os.path.join(NYERS, nev + ".json")
    json.dump(jobs, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(p)

if __name__ == "__main__":
    koteg(sys.argv[1], sys.argv[2:])
