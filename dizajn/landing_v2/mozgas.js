/* Adózz.hu – az értékesítő oldal mozgásai (2026-11-20). Saját fájl, külső könyvtár nélkül.
   CSP default-src 'self' mellett is fut: nincs inline script, nincs eval, nincs inline eseménykezelő.
   Fokozatos javítás: JS nélkül minden tartalom látszik (a „Mit kapsz” lépései egymás alatt, a rétegek végállapotban).
   - html.js: a JS fut;
   - html.mozog: mozgás engedélyezve (prefers-reduced-motion: reduce esetén NEM kerül ki: nincs animáció és nincs automatikus váltás);
   - mobilmenü: menüpontra koppintva, Escape-re és a menün kívül koppintva bezárul (csökkentett mozgásnál is);
   - hős: a telefon képernyői folyamatosan, maguktól váltakoznak (Főoldal → Dosszié → Üzenetek → Fotózás → Határidők), vezérlő nélkül.
     Megáll, amíg egér van rajta vagy fókuszban van (koppintás is fókuszba teszi), ha a fül rejtett, és ha a hős nem látszik;
   - #mit-kapsz: ragadós bemutató gépen és telefonon is. Egyetlen telefon áll, görgetésre lépésenként vált benne a képernyő,
     mellette (gépen) vagy alatta (telefonon) a lépés szövege; 7 részes haladásjelző. Csökkentett mozgásnál ugyanez, átúszás és
     animáció nélkül (a rétegek a végállapotukban).
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
    if (!csendes) hos();
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

  /* ---------- hős: folyamatosan, maguktól váltakozó képernyők, vezérlő nélkül ---------- */
  function hos() {
    var fig = d.querySelector('[data-valto]');
    if (!fig) return;
    var kepek = tomb(fig.querySelectorAll('.valto > img'));
    var n = kepek.length;
    if (n < 2) return;
    var IDO = 4000;
    var i = 0, ora = null, maradek = IDO, t0 = 0;
    var ok = { eger: false, fokusz: false, rejtve: d.hidden, kint: false };

    function all() { return ok.eger || ok.fokusz || ok.rejtve || ok.kint; }
    function mutat(k) {
      var regi = kepek[i];
      regi.classList.remove('aktiv'); regi.classList.add('ki');
      setTimeout(function () { regi.classList.remove('ki'); }, 450);
      kepek[k].classList.remove('ki'); kepek[k].classList.add('aktiv');
      i = k;
    }
    function utemez() {
      clearTimeout(ora); ora = null;
      if (!all()) { t0 = Date.now(); ora = setTimeout(kovetkezo, maradek); }
    }
    function kovetkezo() {
      ora = null; maradek = IDO;
      mutat((i + 1) % n);
      utemez();
    }
    function allit(kulcs, ertek) {
      if (ok[kulcs] === ertek) return;
      if (ora) { clearTimeout(ora); ora = null; maradek = Math.max(800, maradek - (Date.now() - t0)); }
      ok[kulcs] = ertek;
      utemez();
    }

    fig.addEventListener('mouseenter', function () { allit('eger', true); });
    fig.addEventListener('mouseleave', function () { allit('eger', false); });
    fig.addEventListener('focusin', function () { allit('fokusz', true); });
    fig.addEventListener('focusout', function () { allit('fokusz', false); });
    d.addEventListener('visibilitychange', function () { allit('rejtve', d.hidden); });
    if (vanIO) new IntersectionObserver(function (es) { allit('kint', !es[0].isIntersecting); }, { threshold: 0.25 }).observe(fig);

    // a következő képek előtöltése, hogy a váltás ne villanjon
    kepek.forEach(function (img) { img.loading = 'eager'; });
    utemez();
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
    lepesek.forEach(function (l) {
      var lap = l.querySelector('.kepernyo').cloneNode(true);
      tomb(lap.querySelectorAll('img')).forEach(function (img) { img.alt = ''; });
      tarto.appendChild(lap); lapok.push(lap);
      var sz = l.querySelector('.blepes-szoveg').cloneNode(true);
      szovegek.appendChild(sz); cimek.push(sz);
      var s = d.createElement('span'), t = d.createElement('i');
      s.appendChild(t); halado.appendChild(s); toltok.push(t);
    });
    tomb(szinpad.querySelectorAll('[id]')).forEach(function (el) { el.removeAttribute('id'); });
    tel.appendChild(tarto); kepTarto.appendChild(tel);
    szinpad.appendChild(kepTarto); szinpad.appendChild(halado); szinpad.appendChild(szovegek);
    b.insertBefore(szinpad, b.firstChild);
    b.classList.add('szinpad-mod');

    var aktiv = -1, fut = false, keres = 0;
    function jelol(k) {
      [lepesek, lapok, cimek].forEach(function (sor) {
        sor.forEach(function (el, j) { el.classList.toggle('aktiv', j === k); });
      });
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
