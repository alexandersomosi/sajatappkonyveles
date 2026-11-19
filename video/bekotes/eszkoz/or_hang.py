# or_hang.py (2026-11-18) - Gemini 3.8 Flash TTS + blind transcription through OpenRouter for the onboarding video.
# Request shape copied from kukutyini-studio/szinkron_kozos/tts_magyar_gemini.py (gemini_egy, OpenRouter branch):
#   POST https://openrouter.ai/api/v1/audio/speech
#   {"model": "google/gemini-3.8-flash-tts", "response_format": "pcm", "voice": <name>, "input": <text>, "instructions": <style>}
#   -> raw 24 kHz mono s16le PCM.
# The key is read from HKCU\Environment OPENROUTER_API_KEY inside this process only and never printed.
# Every take is cached by the sha1 of its request body (hang/cache/<hash>.pcm); every paid call is logged with its cost to
# ../koltseg.jsonl. Hard budget: BUDGET_USD for this job (cost of a call = OpenRouter generation cost when the API returns it,
# else the account usage delta, else the duration estimate).
import base64, datetime, hashlib, json, os, time, urllib.error, urllib.parse, urllib.request, wave, winreg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "koltseg.jsonl")
CACHE = os.path.join(ROOT, "hang", "cache")
TTS_URL, TTS_MODEL = "https://openrouter.ai/api/v1/audio/speech", "google/gemini-3.8-flash-tts"
CHAT_URL, CHAT_MODEL = "https://openrouter.ai/api/v1/chat/completions", "google/gemini-3.8-flash"
CREDITS_URL = "https://openrouter.ai/api/v1/credits"
BUDGET_USD = float(os.environ.get("BEKOTES_HANG_KERET", "0.30"))
USD_PER_S_TTS = 32 * 9.0 / 1e6           # ~32 audio tokens/s at ~9 USD / 1M output tokens (estimate, kukutyini ledger)
NATIVE_HU = ("Native Hungarian speaker born and raised in Budapest: strictly Hungarian phonetics and intonation, stress always on the "
             "first syllable, long and short vowels kept distinct, no foreign accent at all.")


class Penzhiany(RuntimeError):
    """OpenRouter refused for money (402 / minimum balance) or our own budget is used up."""


def _kulcs():
    k = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not k:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as h:
            k = winreg.QueryValueEx(h, "OPENROUTER_API_KEY")[0].strip()
    return k


def _rejt(s, key):
    return str(s).replace(key, "***") if key else str(s)


def osszes_usage():
    """(account total_usage, total_credits) in USD, or None"""
    key = _kulcs()
    try:
        with urllib.request.urlopen(urllib.request.Request(CREDITS_URL, headers={"Authorization": "Bearer " + key}), timeout=30) as r:
            d = json.loads(r.read()).get("data", {})
        return float(d["total_usage"]), float(d["total_credits"])
    except Exception:
        return None


def koltes():
    """USD spent by this job so far (sum of the ledger)"""
    if not os.path.exists(LEDGER):
        return 0.0
    s = 0.0
    with open(LEDGER, encoding="utf-8") as f:
        for ln in f:
            ln = ln.strip()
            if ln:
                s += float(json.loads(ln).get("usd", 0) or 0)
    return s


def _log(row):
    row = dict(ido=datetime.datetime.now().isoformat(timespec="seconds"), **row)
    with open(LEDGER, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _gen_cost(gen_id, key):
    if not gen_id:
        return None
    for _ in range(4):
        time.sleep(1.5)
        try:
            u = "https://openrouter.ai/api/v1/generation?id=" + urllib.parse.quote(gen_id)
            with urllib.request.urlopen(urllib.request.Request(u, headers={"Authorization": "Bearer " + key}), timeout=30) as r:
                d = json.loads(r.read()).get("data", {})
            c = d.get("total_cost")
            if c is not None:
                return float(c)
        except Exception:
            pass
    return None


def _post(url, body, key, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST",
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), {k.lower(): v for k, v in r.headers.items()}


def tts_body(text, voice, instructions):
    return {"model": TTS_MODEL, "response_format": "pcm", "voice": voice, "input": text, "instructions": instructions}


def cache_ut(text, voice, instructions):
    body = tts_body(text, voice, instructions)
    h = hashlib.sha1(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return os.path.join(CACHE, h + ".pcm"), h, body


def tts(text, voice, instructions, tag, becsult_mp=10.0):
    """-> path of the cached 24 kHz s16le mono PCM (one paid call when not cached)"""
    raw, h, body = cache_ut(text, voice, instructions)
    os.makedirs(CACHE, exist_ok=True)
    if os.path.exists(raw):
        return raw
    if koltes() + becsult_mp * USD_PER_S_TTS * 1.5 > BUDGET_USD:
        raise Penzhiany(f"a saját keret elfogyna ({koltes():.4f} / {BUDGET_USD} USD)")
    key = _kulcs()
    u0 = osszes_usage()
    last = ""
    for i in range(4):
        try:
            pcm, hdr = _post(TTS_URL, body, key)
            if len(pcm) < 12000:
                raise ValueError("túl rövid hang")
            if pcm[:4] == b"RIFF":
                raise ValueError("WAV jött PCM helyett: " + hdr.get("content-type", ""))
            mp = len(pcm) / 48000
            cost = _gen_cost(hdr.get("x-generation-id"), key)
            forras = "generation"
            if cost is None:
                time.sleep(4)
                u1 = osszes_usage()
                if u0 and u1 and 0 < u1[0] - u0[0] < 0.05:
                    cost, forras = u1[0] - u0[0], "usage_delta"
                else:
                    cost, forras = mp * USD_PER_S_TTS, "becsult"
            open(raw + ".tmp", "wb").write(pcm)
            os.replace(raw + ".tmp", raw)
            _log(dict(tipus="tts", tag=tag, modell=TTS_MODEL, hang=voice, mp=round(mp, 2), usd=round(cost, 6),
                      usd_forras=forras, cache=h, karakter=len(text), content_type=hdr.get("content-type", "")))
            return raw
        except urllib.error.HTTPError as e:
            msg = _rejt(e.read().decode("utf-8", "replace"), key)[:300]
            if e.code == 402 or "insufficient" in msg.lower() or "balance" in msg.lower():
                _log(dict(tipus="tts_hiba", tag=tag, kod=e.code, usd=0, uzenet=msg))
                raise Penzhiany(f"OpenRouter {e.code}: {msg}")
            last = f"{e.code}: {msg}"
            time.sleep(20 if e.code == 429 else 5 * (i + 1))
        except (urllib.error.URLError, ValueError, TimeoutError) as e:
            last = _rejt(e, key)[:300]
            time.sleep(5 * (i + 1))
    _log(dict(tipus="tts_hiba", tag=tag, usd=0, uzenet=last))
    raise RuntimeError("TTS hiba: " + last)


def pcm_wav(raw, cel, rate=24000):
    pcm = open(raw, "rb").read()
    os.makedirs(os.path.dirname(cel), exist_ok=True)
    with wave.open(cel, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return cel


def chat(model, prompt, tag, max_tokens=4000, temperature=0.2, json_mode=True, reasoning_tokens=1024):
    """one text chat call (script reviewers) -> text; cost logged; cached by request hash in hang/cache/chat_<hash>.json"""
    body = {"model": model, "max_tokens": max_tokens, "temperature": temperature, "usage": {"include": True},
            "messages": [{"role": "user", "content": prompt}]}
    if reasoning_tokens:
        body["reasoning"] = {"max_tokens": reasoning_tokens}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    h = hashlib.sha1(json.dumps(body, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    os.makedirs(CACHE, exist_ok=True)
    cf = os.path.join(CACHE, f"chat_{h}.json")
    if os.path.exists(cf):
        return json.load(open(cf, encoding="utf-8"))["text"]
    if koltes() + 0.02 > BUDGET_USD:
        raise Penzhiany(f"a saját keret elfogyna ({koltes():.4f} / {BUDGET_USD} USD)")
    key = _kulcs()
    last = ""
    for i in range(3):
        try:
            out, _ = _post(CHAT_URL, body, key, timeout=300)
            d = json.loads(out)
            text = (d["choices"][0]["message"]["content"] or "").strip()
            u = d.get("usage") or {}
            _log(dict(tipus="chat", tag=tag, modell=model, usd=round(float(u.get("cost") or 0), 6), be=u.get("prompt_tokens"),
                      ki=u.get("completion_tokens")))
            json.dump({"text": text}, open(cf, "w", encoding="utf-8"), ensure_ascii=False)
            return text
        except urllib.error.HTTPError as e:
            msg = _rejt(e.read().decode("utf-8", "replace"), key)[:300]
            if e.code == 402:
                raise Penzhiany(f"OpenRouter {e.code}: {msg}")
            last = f"{e.code}: {msg}"
            time.sleep(10 if e.code == 429 else 3 * (i + 1))
        except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as e:
            last = _rejt(e, key)[:300]
            time.sleep(3 * (i + 1))
    raise RuntimeError("chat hiba: " + last)


ATIRAS_PROMPT = ("Transcribe this Hungarian audio clip EXACTLY as it sounds, word by word, in Hungarian spelling. Do not correct "
                 "anything: if a word sounds like a different word or is mispronounced, write what you actually hear (e.g. a wrong "
                 "vowel, or an abbreviation spelled out letter by letter). Output only the transcript.")


def atir(wav_path, tag, proba=0, temperature=0.7):
    """blind transcription (the expected text is NOT sent) -> text; cached in hang/cache/<hash>.atir<proba>.json"""
    data = open(wav_path, "rb").read()
    h = hashlib.sha1(data).hexdigest()[:16]
    cf = os.path.join(CACHE, f"{h}.atir{proba}.json")
    if os.path.exists(cf):
        return json.load(open(cf, encoding="utf-8"))["text"]
    if koltes() + 0.002 > BUDGET_USD:
        raise Penzhiany(f"a saját keret elfogyna ({koltes():.4f} / {BUDGET_USD} USD)")
    key = _kulcs()
    body = {"model": CHAT_MODEL, "temperature": temperature, "usage": {"include": True},
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": ATIRAS_PROMPT},
                {"type": "input_audio", "input_audio": {"data": base64.b64encode(data).decode("ascii"), "format": "wav"}}]}]}
    last = ""
    for i in range(4):
        try:
            out, _ = _post(CHAT_URL, body, key, timeout=120)
            d = json.loads(out)
            text = (d["choices"][0]["message"]["content"] or "").strip()
            u = d.get("usage") or {}
            cost = float(u.get("cost") or 0) or ((u.get("prompt_tokens", 0) * 0.75 + u.get("completion_tokens", 0) * 3.75) / 1e6)
            _log(dict(tipus="atiras", tag=tag, modell=CHAT_MODEL, usd=round(cost, 6),
                      usd_forras="usage.cost" if u.get("cost") else "becsult", be=u.get("prompt_tokens"), ki=u.get("completion_tokens")))
            json.dump({"text": text}, open(cf, "w", encoding="utf-8"), ensure_ascii=False)
            return text
        except urllib.error.HTTPError as e:
            msg = _rejt(e.read().decode("utf-8", "replace"), key)[:300]
            if e.code == 402:
                raise Penzhiany(f"OpenRouter {e.code}: {msg}")
            last = f"{e.code}: {msg}"
            time.sleep(10 if e.code == 429 else 3 * (i + 1))
        except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as e:
            last = _rejt(e, key)[:300]
            time.sleep(3 * (i + 1))
    raise RuntimeError("átírás hiba: " + last)
