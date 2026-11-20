/* Adózz.hu – az értékesítő oldal mozgásai (2026-11-20). Saját fájl, külső könyvtár nélkül.
   CSP default-src 'self' mellett is fut: nincs inline script, nincs eval, nincs inline eseménykezelő.
   Fokozatos javítás: JS nélkül minden tartalom látszik (végállapot). Ez a fájl csak ráadást ad:
   - html.js: a JS fut (a hős vezérlője ekkor válik láthatóvá);
   - html.mozog: mozgás engedélyezve (prefers-reduced-motion: reduce esetén NEM kerül ki: állókép, minden látszik);
   - hős: váltakozó app-képernyők (telefon + gépes böngészőkép), szünet/indítás gomb, nem látható fülön és a képernyőn kívül áll;
   - #mit-kapsz: széles kijelzőn ragadós „színpad” (görgetésre lépésenként vált), keskenyen minden lépés saját telefonja indul;
   - beúszó kártyák és felpörgő számok. Csak transform/opacity mozog (CSS), a számokat requestAnimationFrame lépteti. */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var csendes = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var vanIO = 'IntersectionObserver' in window;

  function indul() {
    html.classList.add('js');
    if (!csendes && vanIO) html.classList.add('mozog');
    hos();
    if (html.classList.contains('mozog')) { bemutato(); beuszas(); }
  }

  function tomb(lista) { return Array.prototype.slice.call(lista); }

  /* ---------- számláló: data-szamlal (cél), data-tol (kezdet), data-kesik, data-ido (ms) ---------- */
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

  /* ---------- hős: váltakozó képernyők ---------- */
  function hos() {
    var fig = d.querySelector('[data-valto]'), vez = d.querySelector('[data-vezerlo]');
    if (!fig || !vez) return;
    var tel = tomb(fig.querySelectorAll('.valto-tel > img')), gep = tomb(fig.querySelectorAll('.valto-gep > img'));
    var fulek = tomb(vez.querySelectorAll('[data-kep]')), gomb = vez.querySelector('[data-szunet]'), felirat = vez.querySelector('[data-felirat]');
    var n = tel.length, i = 0, IDO = 3400;
    var kezi = csendes;            // a látogató állította meg (csökkentett mozgásnál eleve áll)
    var rejtve = false, kint = false, ora = null, maradek = IDO, t0 = 0;
    vez.style.setProperty('--ido', IDO + 'ms');

    function mutat(k) {
      if (k === i) return;
      var regiG = +tel[i].getAttribute('data-gep'), ujG = +tel[k].getAttribute('data-gep');
      tel[i].classList.remove('aktiv'); tel[i].classList.add('ki');
      (function (el) { setTimeout(function () { el.classList.remove('ki'); }, 750); })(tel[i]);
      tel[k].classList.remove('ki'); tel[k].classList.add('aktiv');
      if (regiG !== ujG && gep[regiG] && gep[ujG]) { gep[regiG].classList.remove('aktiv'); gep[ujG].classList.add('aktiv'); }
      fulek[i].classList.remove('aktiv'); fulek[i].removeAttribute('aria-current');
      fulek[k].classList.add('aktiv'); fulek[k].setAttribute('aria-current', 'true');
      felirat.textContent = tel[k].getAttribute('data-cim') || '';
      i = k;
      // a folyamatcsík újraindul
      var csik = fulek[k].querySelector('i');
      if (csik) { csik.style.animation = 'none'; void csik.offsetWidth; csik.style.animation = ''; }
      maradek = IDO;
    }
    function all() { return kezi || rejtve || kint; }
    function frissit() {
      clearTimeout(ora);
      vez.classList.toggle('fut', !kezi);
      vez.classList.toggle('all', all());
      vez.classList.toggle('all-kezi', kezi);
      gomb.setAttribute('aria-label', kezi ? 'Képváltás indítása' : 'Képváltás szüneteltetése');
      if (!all()) { t0 = Date.now(); ora = setTimeout(kovetkezo, maradek); }
    }
    function kovetkezo() { mutat((i + 1) % n); frissit(); }
    function megall() { if (!all()) { maradek = Math.max(0, maradek - (Date.now() - t0)); } }

    gomb.addEventListener('click', function () {
      if (!kezi) { megall(); kezi = true; } else { kezi = false; }
      frissit();
    });
    fulek.forEach(function (f, k) {
      f.addEventListener('click', function () { megall(); mutat(k); frissit(); });
    });
    d.addEventListener('visibilitychange', function () {
      if (d.hidden) { megall(); rejtve = true; } else { rejtve = false; }
      frissit();
    });
    if (vanIO) {
      new IntersectionObserver(function (es) {
        var latszik = es[0].isIntersecting;
        if (!latszik && !kint) { megall(); kint = true; frissit(); }
        else if (latszik && kint) { kint = false; frissit(); }
      }, { threshold: 0.25 }).observe(fig);
    }
    // a következő képek előtöltése, hogy a váltás ne villanjon (a gépes képeké csak ott, ahol a böngészőkép látszik)
    tomb(fig.querySelectorAll('img[loading="lazy"]')).forEach(function (img) {
      if (img.offsetParent !== null) img.loading = 'eager';
    });
    frissit();
  }

  /* ---------- #mit-kapsz: mozgó bemutató ---------- */
  function bemutato() {
    var b = d.querySelector('[data-bemutato]');
    if (!b) return;
    var lepesek = tomb(b.querySelectorAll('.blepes'));
    var kepernyok = lepesek.map(function (l) { return l.querySelector('.kepernyo'); });
    var szeles = window.matchMedia('(min-width: 981px)');

    // keskeny kijelző: minden lépés telefonja akkor indul, amikor a képernyőre ér (és újraindul, ha visszagörgetsz)
    var kepTartok = lepesek.map(function (l) { return l.querySelector('.blepes-kep'); });
    var kisIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var k = e.target.querySelector('.kepernyo');
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && !e.target._fut) { e.target._fut = true; inditKepernyo(k); }
        else if (!e.isIntersecting) { e.target._fut = false; }
      });
    }, { threshold: [0, 0.5] });

    // széles kijelző: ragadós színpad a lépések telefonjaiból
    var szinpad = null, lapok = [], fenyek = [], pontok = [], aktiv = -1, nagyIO = null;
    function epit() {
      szinpad = d.createElement('div');
      szinpad.className = 'szinpad';
      szinpad.setAttribute('aria-hidden', 'true');
      var fenyTarto = d.createElement('div'); fenyTarto.className = 'szinpad-fenyek';
      var tel = d.createElement('div'); tel.className = 'telefon';
      var tarto = d.createElement('div'); tarto.className = 'szinpad-tarto';
      var pontTarto = d.createElement('div'); pontTarto.className = 'szinpad-pontok';
      kepernyok.forEach(function (k) {
        var szin = (k.className.match(/szin-[a-z]+/) || [''])[0];
        var lap = k.cloneNode(true);
        tomb(lap.querySelectorAll('img')).forEach(function (img) { img.alt = ''; img.loading = 'eager'; });
        tomb(lap.querySelectorAll('[id]')).forEach(function (el) { el.removeAttribute('id'); });
        tarto.appendChild(lap); lapok.push(lap);
        var f = d.createElement('span'); f.className = szin; fenyTarto.appendChild(f); fenyek.push(f);
        var p = d.createElement('span'); p.className = szin; pontTarto.appendChild(p); pontok.push(p);
      });
      tel.appendChild(tarto);
      szinpad.appendChild(fenyTarto); szinpad.appendChild(tel); szinpad.appendChild(pontTarto);
      b.appendChild(szinpad);
      nagyIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) aktival(lepesek.indexOf(e.target)); });
      }, { rootMargin: '-46% 0px -46% 0px' });
    }
    function jelol(k) {
      [lepesek, lapok, fenyek, pontok].forEach(function (sor) {
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

  /* ---------- beúszás görgetéskor ---------- */
  function beuszas() {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('latszik'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    tomb(d.querySelectorAll('.be, .be-sor')).forEach(function (el) { io.observe(el); });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', indul); else indul();
})();
