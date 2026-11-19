# minden.py - the whole onboarding video in one command: voice step -> picture step -> checks.
#   python eszkoz/minden.py              (voice; when OpenRouter refuses, a SILENT captioned preview with estimated timing)
#   python eszkoz/minden.py --becsult    (no API call at all: silent preview)
import os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
E = os.path.dirname(os.path.abspath(__file__))
py = [sys.executable, "-X", "utf8"]

r = subprocess.run(py + [os.path.join(E, "hang_lepes.py")] + (["--becsult"] if "--becsult" in sys.argv else []))
if r.returncode not in (0, 3):
    sys.exit(r.returncode)
hang_ok = r.returncode == 0 and "--becsult" not in sys.argv
subprocess.run(py + [os.path.join(E, "render.py")], check=True)
t = subprocess.run(py + [os.path.join(E, "teszt.py")])
print("\n" + ("KÉSZ, HANGGAL." if hang_ok else "KÉSZ, DE NÉMA ELŐZETES: a hang nem készült el (lásd hang/kiejtes.json / koltseg.jsonl)."))
sys.exit(t.returncode or (0 if hang_ok else 3))
