"""OpenRouter közös segéd: a kulcsot a Windows felhasználói környezetből olvassa (HKCU\Environment),
soha nem írja ki, nem naplózza."""
import json, os, sys, time, base64, datetime
import requests

def _kulcs():
    k = os.environ.get("OPENROUTER_API_KEY")
    if k:
        return k
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as h:
        v, _ = winreg.QueryValueEx(h, "OPENROUTER_API_KEY")
    return v

def fejlec():
    return {"Authorization": "Bearer " + _kulcs(), "Content-Type": "application/json",
            "HTTP-Referer": "https://localhost/kezjegy", "X-Title": "Kezjegy assets"}

def kredit():
    r = requests.get("https://openrouter.ai/api/v1/credits", headers=fejlec(), timeout=30)
    r.raise_for_status()
    d = r.json()["data"]
    return d["total_credits"], d["total_usage"], d["total_credits"] - d["total_usage"]

if __name__ == "__main__":
    t, u, b = kredit()
    print(f"total_credits={t:.4f} total_usage={u:.4f} balance={b:.4f}")
