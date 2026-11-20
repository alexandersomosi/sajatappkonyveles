/* Adózz.hu – az értékesítő oldal mozgásai (2. kör, 2026-11-20 este). Saját fájl, külső könyvtár nélkül.
   CSP default-src 'self' mellett is fut: nincs inline script, nincs eval, nincs inline eseménykezelő.
   Fokozatos javítás: JS nélkül minden tartalom látszik (végállapot). Ez a fájl csak ráadást ad, és csak a termék mozog:
   - html.js: a JS fut;
   - html.mozog: mozgás engedélyezve (prefers-reduced-motion: reduce esetén NEM kerül ki: állókép, minden látszik);
   - hős: a telefon képernyői maguktól váltakoznak (Főoldal → Dosszié → Üzenetek → Fotózás → Határidők), vezérlő nélkül.
     Két kör után a Főoldalon megáll. Megáll, amíg egér van rajta vagy fókuszban van, ha a fül rejtett, és ha a hős nem látszik;
   - #mit-kapsz: széles kijelzőn ragadós telefon (görgetésre lépésenként vált), keskenyen minden lépés saját telefonja indul.
   Nincs beúszó szakasz és felemelkedő kártya. Csak transform/opacity mozog (CSS); a telefonon belüli számokat requestAnimationFrame lépteti. */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var csendes = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var vanIO = 'IntersectionObserver' in window;

  function indul() {
    html.classList.add('js');
    if (csendes || !vanIO) return;   // állókép: az első hős-kép és minden réteg a végállapotában
    html.classList.add('mozog');
    hos();
    bemutato();
  }

  function tomb(lista) { return Array.prototype.slice.call(lista); }

  /* ---------- számláló a telefon képernyőjén: data-szamlal (cél), data-tol (kezdet), data-kesik, data-ido (ms) ---------- */
  function formaz(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
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

  /* ---------- hős: maguktól váltakozó képernyők, vezérlő nélkül ---------- */
  function hos() {
    var fig = d.querySelector('[data-valto]');
    if (!fig) return;
    var kepek = tomb(fig.querySelectorAll('.valto > img'));
    var n = kepek.length;
    if (n < 2) return;
    var IDO = 4000, KOROK = 2;
    var i = 0, valtas = 0, ora = null, maradek = IDO, t0 = 0;
    var ok = { eger: false, fokusz: false, rejtve: d.hidden, kint: false, vege: false };

    function all() { return ok.eger || ok.fokusz || ok.rejtve || ok.kint || ok.vege; }
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
      valtas++;
      if (valtas >= n * KOROK) ok.vege = true;   // két teljes kör után a Főoldalon áll
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
    new IntersectionObserver(function (es) { allit('kint', !es[0].isIntersecting); }, { threshold: 0.25 }).observe(fig);

    // a következő képek előtöltése, hogy a váltás ne villanjon
    kepek.forEach(function (img) { img.loading = 'eager'; });
    utemez();
  }

  /* ---------- #mit-kapsz: mozgó bemutató ---------- */
  function bemutato() {
    var b = d.querySelector('[data-bemutato]');
    if (!b) return;
    var lepesek = tomb(b.querySelectorAll('.blepes'));
    var kepernyok = lepesek.map(function (l) { return l.querySelector('.kepernyo'); });
    var szeles = window.matchMedia('(min-width: 981px)');

    // keskeny kijelző: minden lépés telefonja akkor indul, amikor félig a képernyőre ér (és újraindul, ha visszagörgetsz)
    var kepTartok = lepesek.map(function (l) { return l.querySelector('.blepes-kep'); });
    var kisIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var k = e.target.querySelector('.kepernyo');
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && !e.target._fut) { e.target._fut = true; inditKepernyo(k); }
        else if (!e.isIntersecting) { e.target._fut = false; }
      });
    }, { threshold: [0, 0.5] });

    // széles kijelző: egyetlen ragadós telefon a lépések képernyőiből
    var szinpad = null, lapok = [], aktiv = -1, nagyIO = null;
    function epit() {
      szinpad = d.createElement('div');
      szinpad.className = 'szinpad';
      szinpad.setAttribute('aria-hidden', 'true');
      var tel = d.createElement('div'); tel.className = 'telefon';
      var tarto = d.createElement('div'); tarto.className = 'szinpad-tarto';
      kepernyok.forEach(function (k) {
        var lap = k.cloneNode(true);
        tomb(lap.querySelectorAll('img')).forEach(function (img) { img.alt = ''; img.loading = 'eager'; });
        tomb(lap.querySelectorAll('[id]')).forEach(function (el) { el.removeAttribute('id'); });
        tarto.appendChild(lap); lapok.push(lap);
      });
      tel.appendChild(tarto);
      szinpad.appendChild(tel);
      b.appendChild(szinpad);
      nagyIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) aktival(lepesek.indexOf(e.target)); });
      }, { rootMargin: '-46% 0px -46% 0px' });
    }
    function jelol(k) {
      [lepesek, lapok].forEach(function (sor) {
        sor.forEach(function (el, j) { el.classList.toggle('aktiv', j === k); });
      });
    }
    function aktival(k) {
      if (k === aktiv || k < 0) return;
      if (aktiv >= 0) lapok[aktiv].classList.remove('fut');
      aktiv = k;
      jelol(k);
      inditKepernyo(lapok[k]);
    }
    function mod() {
      if (szeles.matches) {
        if (!szinpad) epit();
        kepTartok.forEach(function (t) { kisIO.unobserve(t); t._fut = false; });
        b.classList.add('szinpad-mod');
        if (aktiv < 0) jelol(0); // az első lap látszik, de csak akkor indul, amikor a lépés középre ér
        lepesek.forEach(function (l) { nagyIO.observe(l); });
      } else {
        if (nagyIO) lepesek.forEach(function (l) { nagyIO.unobserve(l); });
        b.classList.remove('szinpad-mod');
        kepTartok.forEach(function (t) { kisIO.observe(t); });
      }
    }
    if (szeles.addEventListener) szeles.addEventListener('change', mod); else if (szeles.addListener) szeles.addListener(mod);
    mod();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', indul); else indul();
})();
