' Adozz kulso mentes oránként, LATHATATLANUL (nem vesz el fokuszt jatek kozben).
' A Windows Feladatutemezo inditja: wscript.exe ...\mentes-kulso-rejtett.vbs (feladat neve: "Adozz mentes kulso").
' A mentes-kulso.sh az appok-1 uj titkositott menteseit masolja a Hetzner Storage Boxra (hetzner-tar), ellenorizve.
' Naplo: C:\Users\UpgradePC\konyvelo_app\_munka\mentes_kulso.log
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\Program Files\Git\bin\bash.exe"" -lc ""echo === $(date '+%F %T') >> C:/Users/UpgradePC/konyvelo_app/_munka/mentes_kulso.log; bash C:/Users/UpgradePC/konyvelo_app/kod/deploy/mentes-kulso.sh >> C:/Users/UpgradePC/konyvelo_app/_munka/mentes_kulso.log 2>&1""", 0, False
