/* Adózz.hu – az értékesítő oldal mozgásai (2026-11-20). Saját fájl, külső könyvtár nélkül.
   CSP default-src 'self' mellett is fut: nincs inline script, nincs eval, nincs inline eseménykezelő.
   Fokozatos javítás: JS nélkül minden tartalom látszik (a „Mit kapsz” lépései egymás alatt, a rétegek végállapotban).
   - html.js: a JS fut;
   - html.mozog: mozgás engedélyezve (prefers-reduced-motion: reduce esetén NEM kerül ki: nincs animáció és nincs automatikus váltás);
   - mobilmenü: menüpontra koppintva, Escape-re és a menün kívül koppintva bezárul (csökkentett mozgásnál is);
   - hős (3. kör, tulaj 11-20 23:38): a telefon NEM vált magától. A képernyőn látható alsó menü 4 pontja (Főoldal, Dosszié, Fotózás,
     Üzenetek) fölött 4 átlátszó <button> van; koppintásra/kattintásra (billentyűzettel Enter/Szóköz) a telefon ÉS a mögötte álló
     böngészőablak is arra a nézetre vált (finom áttűnés; csökkentett mozgásnál azonnal). Betöltéskor egyszeri koppintás-jel a menün,
     „Próbáld ki” felirat; az első kattintás után mindkettő eltűnik. JS nélkül a Főoldal áll, a gombok nem látszanak;
   - #mit-kapsz: ragadós bemutató gépen és telefonon is. Egyetlen telefon áll, görgetésre lépésenként vált benne a képernyő,
     mellette (gépen) vagy alatta (telefonon) a lépés szövege; lépésenként egy részes haladásjelző. Az utolsó lépés („Gépen is
     ugyanez”): a telefon kisebb lesz és félrehúzódik, mögötte beúszik a böngészőablak a gépes nézettel. Csökkentett mozgásnál
     ugyanez, átúszás és animáció nélkül (a rétegek a végállapotukban).
   Csak transform/opacity mozog (CSS); a telefonon belüli számokat requestAnimationFrame lépteti. */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var csendes = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var vanIO = 'IntersectionObserver' in window;

  function indul() {
    html.classList.add('js');
    mobilmenu();
    if (!csendes) html.classList.add('mozog');
    bemutato();
    hos();   // a menü csökkentett mozgásnál is működik (ott azonnal, áttűnés nélkül vált)
  }

  function tomb(lista) { return Array.prototype.slice.call(lista); }

  /* ---------- mobilmenü (natív <details>): bezárás menüpontra, Escape-re, kívül koppintásra ---------- */
  function mobilmenu() {
    var m = d.querySelector('.mobilmenu');
    if (!m) return;
    m.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.mobilmenu-lap a') : null;
      if (a) m.open = false;
    });
    d.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && m.open) {
        m.open = false;
        var s = m.querySelector('summary'); if (s) s.focus();
      }
    });
    d.addEventListener('click', function (e) { if (m.open && !m.contains(e.target)) m.open = false; });
  }

  /* ---------- számláló a telefon képernyőjén: data-szamlal (cél), data-tol (kezdet), data-kesik, data-ido (ms) ---------- */
  function formaz(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function szamlal(el) {
    var cel = +el.getAttribute('data-szamlal'), tol = +(el.getAttribute('data-tol') || 0);
    var kesik = +(el.getAttribute('data-kesik') || 0), ido = +(el.getAttribute('data-ido') || 1200);
    var jel = (el._jel || 0) + 1; el._jel = jel;
    el.textContent = formaz(tol);
    setTimeout(function () {
      var t0 = null;
      function lep(t) {
        if (el._jel !== jel) return;
        if (t0 === null) t0 = t;
        var x = Math.min(1, (t - t0) / ido), e = 1 - Math.pow(1 - x, 3);
        el.textContent = formaz(tol + (cel - tol) * e);
        if (x < 1) requestAnimationFrame(lep);
      }
      requestAnimationFrame(lep);
    }, kesik);
  }
  function inditKepernyo(k) {
    k.classList.remove('fut');
    void k.offsetWidth; // újraindítja a CSS-animációkat
    k.classList.add('fut');
    tomb(k.querySelectorAll('[data-szamlal]')).forEach(szamlal);
  }

  /* ---------- hős: a telefon menüje (4 gomb a képen látható menüpontok fölött) váltja a képernyőt,
     a mögötte álló böngészőablak ugyanarra a nézetre vált. Magától nem vált. ---------- */
  function hos() {
    var k = d.querySelector('[data-hos]');
    if (!k) return;
    var gombok = tomb(k.querySelectorAll('.hos-menu button'));
    // minden .valto (telefon, böngésző) képei, sorrendben: Főoldal, Dosszié, Fotózás (gépen: papír beküldése), Üzenetek
    var sorok = tomb(k.querySelectorAll('.valto')).map(function (v) {
      return tomb(v.children).filter(function (el) { return el.tagName === 'IMG'; });
    });
    if (!gombok.length) return;
    var akt = 0;
    function mutat(i) {
      if (i === akt) return;
      sorok.forEach(function (kepek) {
        if (!kepek[i] || !kepek[akt]) return;
        kepek[akt].classList.remove('aktiv');
        kepek[i].classList.add('aktiv');
      });
      gombok.forEach(function (g, j) { g.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      akt = i;
    }
    gombok.forEach(function (g, j) {
      g.addEventListener('click', function () { k.classList.add('kiprobalta'); mutat(j); });
    });
    // a többi képernyő előtöltése, hogy az első koppintás se villanjon
    sorok.forEach(function (kepek) { kepek.forEach(function (img) { img.loading = 'eager'; }); });
    // egyszeri koppintás-jel a menün, amikor a hős először látszik (csak mozgással; a CSS rejti, ha már kipróbálta)
    if (csendes) return;
    if (!vanIO) { k.classList.add('kopp'); return; }
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { k.classList.add('kopp'); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(k.querySelector('.kompo-tel') || k);
  }

  /* ---------- #mit-kapsz: ragadós bemutató (gépen és telefonon) ---------- */
  function bemutato() {
    var b = d.querySelector('[data-bemutato]');
    if (!b) return;
    var lepesek = tomb(b.querySelectorAll('.blepes'));
    var n = lepesek.length;
    if (!n) return;
    var szeles = window.matchMedia('(min-width: 981px)');

    // a színpad: egy telefon a lépések képernyőiből + haladásjelző + (keskeny kijelzőn) a lépések szövege. Csak látvány: aria-hidden.
    var szinpad = d.createElement('div'); szinpad.className = 'szinpad'; szinpad.setAttribute('aria-hidden', 'true');
    var kepTarto = d.createElement('div'); kepTarto.className = 'szinpad-kep';
    var tel = d.createElement('div'); tel.className = 'telefon';
    var tarto = d.createElement('div'); tarto.className = 'szinpad-tarto';
    var halado = d.createElement('div'); halado.className = 'halado';
    var szovegek = d.createElement('div'); szovegek.className = 'szinpad-szovegek';
    var lapok = [], cimek = [], toltok = [];
    // zárólépés („Gépen is ugyanez”): a lépés böngészőablaka a telefon MÖGÉ kerül; amikor ez a lépés aktív, a színpad .gep-mod
    var gepLepes = -1, bongeszo = null;
    lepesek.forEach(function (l, j) {
      var lap = l.querySelector('.kepernyo').cloneNode(true);
      tomb(lap.querySelectorAll('img')).forEach(function (img) { img.alt = ''; });
      tarto.appendChild(lap); lapok.push(lap);
      var b0 = l.querySelector('.bongeszo');
      if (b0 && !bongeszo) {
        bongeszo = b0.cloneNode(true); bongeszo.classList.add('szinpad-bongeszo'); gepLepes = j;
        tomb(bongeszo.querySelectorAll('img')).forEach(function (img) { img.alt = ''; });
      }
      var sz = l.querySelector('.blepes-szoveg').cloneNode(true);
      szovegek.appendChild(sz); cimek.push(sz);
      var s = d.createElement('span'), t = d.createElement('i');
      s.appendChild(t); halado.appendChild(s); toltok.push(t);
    });
    tomb(szinpad.querySelectorAll('[id]')).forEach(function (el) { el.removeAttribute('id'); });
    tel.appendChild(tarto);
    if (bongeszo) kepTarto.appendChild(bongeszo);
    kepTarto.appendChild(tel);
    szinpad.appendChild(kepTarto); szinpad.appendChild(halado); szinpad.appendChild(szovegek);
    b.insertBefore(szinpad, b.firstChild);
    b.classList.add('szinpad-mod');

    var aktiv = -1, fut = false, keres = 0;
    function jelol(k) {
      [lepesek, lapok, cimek].forEach(function (sor) {
        sor.forEach(function (el, j) { el.classList.toggle('aktiv', j === k); });
      });
      szinpad.classList.toggle('gep-mod', k === gepLepes);
    }
    function aktival(k, indit) {
      if (k !== aktiv) {
        var regi = aktiv >= 0 ? lapok[aktiv] : null;
        aktiv = k;
        jelol(k);
        if (regi) setTimeout(function () { if (regi !== lapok[aktiv]) regi.classList.remove('fut'); }, 320);
        fut = false;
      }
      if (indit && !fut && !csendes) { fut = true; inditKepernyo(lapok[k]); }
    }
    function korlat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    function szamol() {
      keres = 0;
      var vh = window.innerHeight || html.clientHeight;
      var br = b.getBoundingClientRect();
      var tops = lepesek.map(function (l) { return l.getBoundingClientRect(); });
      var k = 0, toltes = [];
      if (szeles.matches) {
        // gépen: az a lépés aktív, amelyiken a képernyő közepe áll
        var vonal = vh * 0.5;
        tops.forEach(function (r, j) {
          if (r.top <= vonal) k = j;
          toltes.push(korlat((vonal - r.top) / Math.max(1, r.height)));
        });
      } else {
        // telefonon: a ragadós szakasz görgetési hosszát egyenlően osztjuk el a lépések között
        var fent = parseFloat(window.getComputedStyle(szinpad).top) || 0;
        var hossz = tops[n - 1].bottom - tops[0].top - szinpad.offsetHeight;
        var p = hossz > 0 ? (fent - tops[0].top) / hossz : 0;
        var x = korlat(p) * n;
        k = Math.min(n - 1, Math.floor(x));
        for (var j = 0; j < n; j++) toltes.push(korlat(x - j));
      }
      toltok.forEach(function (t, j) {
        var f = csendes ? (j <= k ? 1 : 0) : toltes[j];
        t.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      });
      // a képernyő akkor indul, amikor a bemutató már jól látszik; ha teljesen kikerül a képből, legközelebb újraindul
      var latszik = br.top < vh * 0.6 && br.bottom > vh * 0.4;
      if (br.bottom < 0 || br.top > vh) { if (fut && aktiv >= 0) lapok[aktiv].classList.remove('fut'); fut = false; }
      aktival(k, latszik);
    }
    function kerj() { if (!keres) keres = window.requestAnimationFrame(szamol); }
    window.addEventListener('scroll', kerj, { passive: true });
    window.addEventListener('resize', kerj);
    if (szeles.addEventListener) szeles.addEventListener('change', kerj); else if (szeles.addListener) szeles.addListener(kerj);
    jelol(0);
    szamol();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', indul); else indul();
})();
