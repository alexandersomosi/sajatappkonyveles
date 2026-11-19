"""Kézjegy C2 képelem-generálás az OpenRouter Image API-n (POST /api/v1/images).
Használat: python gen.py <batch.json> [--cimke "szöveg"]
batch.json: [{"nev": "...", "model": "...", "prompt": "...", "aspect_ratio": "4:3", "resolution": "1K"?, "ref": "útvonal"?}, ...]
Keret: ez a feladat legfeljebb 1,40 USD-t költhet, és az egyenleg nem eshet 0,70 USD alá.
Minden hívás bekerül a ../_naplo.md-be és a ../_nyers/koltseg.jsonl-be. A kulcs csak a folyamatban él."""
import base64, json, os, sys, time, datetime, threading
from concurrent.futures import ThreadPoolExecutor
import requests
from or_kozos import fejlec, kredit

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
NYERS = os.path.join(ASSETS, "_nyers")
NAPLO = os.path.join(ASSETS, "_naplo.md")
LEDGER = os.path.join(NYERS, "koltseg.jsonl")
START = os.path.join(NYERS, "kezdo_egyenleg.json")
KERET = 1.40
PADLO = 0.70
API = "https://openrouter.ai/api/v1/images"
CHAT_API = "https://openrouter.ai/api/v1/chat/completions"
LOCK = threading.Lock()

# becsült listaár / kép (USD), csak a keret-előellenőrzéshez; a napló a usage.cost-ot írja
BECSLES = {"google/gemini-2.5-flash-image": 0.04, "recraft/recraft-v4.1-flash": 0.01,
           "recraft/recraft-v4.1-flash-v2:free": 0.0, "recraft/recraft-v4.1-flash-v2": 0.01,
           "black-forest-labs/flux-3-image-klein": 0.01, "recraft/recraft-v4.1": 0.04,
           "black-forest-labs/flux.2-klein-4b": 0.016, "openai/gpt-image-1-mini": 0.02}

def elkoltott():
    s = 0.0
    if os.path.exists(LEDGER):
        for line in open(LEDGER, encoding="utf-8"):
            line = line.strip()
            if line:
                s += float(json.loads(line).get("cost") or 0)
    return s

def naplo(sor):
    with LOCK:
        new = not os.path.exists(NAPLO)
        with open(NAPLO, "a", encoding="utf-8") as f:
            if new:
                f.write("# Képelem-napló (Kézjegy C2)\n\nMinden OpenRouter-hívás: idő, modell, név, költség (usage.cost, ha nincs: listaár-becslés), kimenet, prompt. "
                        "Keret: legfeljebb 1,40 USD, az egyenleg nem eshet 0,70 USD alá.\n")
            f.write(sor + "\n")

def ref_url(p):
    ext = os.path.splitext(p)[1].lower().lstrip(".")
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
    return "data:%s;base64,%s" % (mime, base64.b64encode(open(p, "rb").read()).decode())

def egy(job):
    model = job["model"]
    est = BECSLES.get(model, 0.05)
    with LOCK:
        spent = elkoltott()
        if spent + est > KERET:
            return job["nev"], "KERET", None
    # 11-17 este: az /images végpont a Gemini-hívás LEHETSÉGES maximumát ~1,48 USD-re becsli, 1,48 USD alatti egyenlegnél
    # minden hívást 402 weight_exceeds_budget-tel elutasít. Ezért a Gemini a chat/completions végponton megy,
    # korlátozott max_tokens-szel (egy kép 1290 kimeneti token), így a becsült maximum kicsi; a tényleges ár ugyanaz.
    chat = job.get("api", "chat" if model.startswith("google/") else "images") == "chat"
    if chat:
        tartalom = [{"type": "text", "text": job["prompt"]}]
        if job.get("ref"):
            tartalom.append({"type": "image_url", "image_url": {"url": ref_url(job["ref"])}})
        body = {"model": model, "messages": [{"role": "user", "content": tartalom}], "modalities": ["image", "text"],
                "image_config": {"aspect_ratio": job.get("aspect_ratio", "1:1")}, "max_tokens": int(job.get("max_tokens", 2400)),
                "usage": {"include": True}}
        url = CHAT_API
    else:
        body = {"model": model, "prompt": job["prompt"], "aspect_ratio": job.get("aspect_ratio", "1:1"), "n": 1}
        if job.get("resolution"):
            body["resolution"] = job["resolution"]
        if job.get("ref"):
            body["input_references"] = [{"type": "image_url", "image_url": {"url": ref_url(job["ref"])}}]
        url = API
    time.sleep(float(os.environ.get("SZUNET", "0")))  # egyenkénti küldésnél szünet a hívások között (in-flight 402 ellen)
    t0 = time.time()
    out, cost, src, err, dims = None, None, None, None, None
    try:
        r = requests.post(url, headers=fejlec(), json=body, timeout=240)
        if r.status_code == 402:  # in-flight 402: egyszer újra, pár másodperc múlva
            time.sleep(float(os.environ.get("VARAS402", "15")))
            r = requests.post(url, headers=fejlec(), json=body, timeout=240)
        if r.status_code != 200:
            err = f"HTTP {r.status_code}: {r.text[:1500]}"
        else:
            j = r.json()
            if chat:
                msg = ((j.get("choices") or [{}])[0].get("message") or {})
                kepek = msg.get("images") or []
                item = {"url": kepek[0]["image_url"]["url"]} if kepek else {}
                if msg.get("content"):
                    job["_szoveg"] = str(msg["content"])[:300]
            else:
                item = (j.get("data") or [{}])[0]
            raw = None
            if item.get("b64_json"):
                raw = base64.b64decode(item["b64_json"])
            elif item.get("url"):
                u = item["url"]
                raw = base64.b64decode(u.split(",", 1)[1]) if u.startswith("data:") else requests.get(u, timeout=120).content
            if raw:
                ext = ".svg" if raw[:5] in (b"<?xml", b"<svg ") else ".png"
                if raw[:3] == b"\xff\xd8\xff": ext = ".jpg"
                if raw[:4] == b"RIFF": ext = ".webp"
                out = os.path.join(NYERS, job["nev"] + ext)
                open(out, "wb").write(raw)
                try:
                    from PIL import Image
                    with Image.open(out) as im: dims = im.size
                except Exception:
                    pass
            cost = (j.get("usage") or {}).get("cost")
            src = "usage.cost" if cost is not None else "listaár-becslés"
            if cost is None:
                cost = est
            if not raw:
                err = "nincs kép a válaszban: " + json.dumps(j)[:300]
    except Exception as e:
        err = repr(e)[:300]
    dt = time.time() - t0
    rec = {"t": datetime.datetime.now().strftime("%H:%M:%S"), "nev": job["nev"], "model": model, "cost": cost or 0,
           "cost_src": src, "s": round(dt, 1), "file": os.path.relpath(out, ASSETS) if out else None, "dims": dims, "err": err}
    with LOCK:
        with open(LEDGER, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    allapot = f"`{rec['file']}`" + (f", {dims[0]}x{dims[1]}" if dims else "") if out else f"HIBA: {err}"
    prompt_md = job["prompt"].replace("\n", " ")
    naplo(f"- `{rec['t']}` **{model}** ({'chat/completions' if chat else 'images'}), `{job['nev']}`, {rec['cost']:.4f} USD ({src or 'nem számlázva'}), {dt:.0f} s, {allapot}"
          + (f", a modell szövege: „{job['_szoveg']}”" if job.get("_szoveg") else "")
          + (f", referencia: `{os.path.relpath(job['ref'], ASSETS)}`" if job.get("ref") else "")
          + f"\n  - prompt: {prompt_md}")
    return job["nev"], err or "OK", rec["cost"]

def main():
    batch = json.load(open(sys.argv[1], encoding="utf-8"))
    cimke = sys.argv[sys.argv.index("--cimke") + 1] if "--cimke" in sys.argv else os.path.basename(sys.argv[1])
    os.makedirs(NYERS, exist_ok=True)
    t, u, bal = kredit()
    if not os.path.exists(START):
        json.dump({"egyenleg": bal, "ido": datetime.datetime.now().isoformat(timespec="seconds")}, open(START, "w"))
    start = json.load(open(START))["egyenleg"]
    spent = elkoltott()
    naplo(f"\n## {datetime.datetime.now():%Y-%m-%d %H:%M}, köteg: {cimke}\n\nEgyenleg előtte: {bal:.4f} USD (kezdő: {start:.4f}, a naplóban eddig: {spent:.4f} USD, a kezdő óta a fiókon: {start - bal:.4f} USD)\n")
    if bal < PADLO or (start - bal) >= KERET or spent >= KERET:
        naplo("Megállva: a keret vagy a padló elérve.")
        print("STOP: keret/padló", bal, spent); return
    with ThreadPoolExecutor(max_workers=int(os.environ.get("PAR", "4"))) as ex:
        for nev, st, c in ex.map(egy, batch):
            print(nev, st, c, flush=True)
    time.sleep(2)
    t, u, bal2 = kredit()
    spent = elkoltott()
    naplo(f"\nEgyenleg utána: {bal2:.4f} USD (a köteg a fiókon: {bal - bal2:.4f} USD; a naplóban összesen: {spent:.4f} USD; a kezdő óta: {start - bal2:.4f} USD)\n")
    print(f"balance {bal2:.4f}  spent_ledger {spent:.4f}  spent_since_start {start - bal2:.4f}")

if __name__ == "__main__":
    main()
