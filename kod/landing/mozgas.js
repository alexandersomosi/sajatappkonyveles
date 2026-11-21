/* Adózz.hu – az értékesítő oldal mozgásai (2026-11-20). Saját fájl, külső könyvtár nélkül.
   CSP default-src 'self' mellett is fut: nincs inline script, nincs eval, nincs inline eseménykezelő.
   Fokozatos javítás: JS nélkül minden tartalom látszik (a „Mit kapsz” lépései egymás alatt, a rétegek végállapotban).
   - html.js: a JS fut;
   - html.mozog: mozgás engedélyezve (prefers-reduced-motion: reduce esetén NEM kerül ki: nincs animáció és nincs automatikus váltás);
   - mobilmenü: menüpontra koppintva, Escape-re és a menün kívül koppintva bezárul (csökkentett mozgásnál is);
   - hős (3. kör, tulaj 11-20 23:38): a telefon NEM vált magától. A képernyőn látható alsó menü 4 pontja (Főoldal, Dosszié, Fotózás,
     Üzenetek) fölött 4 átlátszó <button> van; koppintásra/kattintásra (billentyűzettel Enter/Szóköz) a telefon ÉS a mögötte álló
     böngészőablak is arra a nézetre vált (finom áttűnés; csökkentett mozgásnál azonnal). A böngészőablak oldalsávjának menüpontjai
     is kattinthatók (egérrel/koppintással; aria-hidden, tabindex=-1, mert a telefon gombjai ugyanezt tudják). Felirat NINCS
     (tulaj, 11-20 23:50); betöltés után egyetlen, szöveg nélküli gyűrű a Dosszié ikonján, ami az első kattintás után és csökkentett
     mozgásnál nem jelenik meg. JS nélkül a Főoldal áll, a gombok nem látszanak;
   - #mit-kapsz: ragadós bemutató gépen és telefonon is. Egyetlen telefon áll, görgetésre lépésenként vált benne a képernyő,
     mellette (gépen) vagy alatta (telefonon) a lépés szövege; lépésenként egy részes haladásjelző. Az utolsó lépés („Gépen is
     ugyanez”): a telefon kisebb lesz és félrehúzódik, mögötte beúszik a böngészőablak a gépes nézettel. Csökkentett mozgásnál
     ugyanez, átúszás és animáció nélkül (a rétegek a végállapotukban).
     Telefonon (keskeny nézet, ≤ 980 px, érintőképernyő; tulaj 11-21): minden görgetési mozdulat pontosan EGY lépés. A lépések egy-egy színpadnyi
     magasak, mindegyik elején egy láthatatlan beakadási pont (.beakado, CSS scroll-snap, scroll-snap-stop: always), és egy-egy a
     szakasz tetején (.beakado-be) és a lista végén (.beakado-ki). A gyökér görgetője (html.beakad: scroll-snap-type: y mandatory)
     CSAK a két szélső pont között kapcsol be: a szakasz előtt és után, és a két szélső ponton is szabad a görgetés, így sehol nem
     ragad be. Horgony-linkre (menü) és fókuszváltásra a beakadás rövid időre kikapcsol, hogy a link oda vigyen, ahová kell.
     Egérrel (keskeny asztali ablakban is) nincs beakadás: ott a görgő a legközelebbi lépésre ugrana vissza.
     A telefon mellett egy szöveg nélküli, pattogó nyíl (.szinpad-nyil) jelzi, hogy lefelé kell görgetni; az utolsó lépésnél eltűnik.
   Csak transform/opacity mozog (CSS); a telefonon belüli számokat requestAnimationFrame lépteti. */
(function () {
  'use strict';
  var d = document, html = d.documentElement;
  var csendes = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var vanIO = 'IntersectionObserver' in window;

  // egy rész hibája ne vigye magával a többit (pl. a hős gombjai akkor is működjenek, ha a bemutató elhasal)
  function biztos(f) { try { f(); } catch (e) { if (window.console && console.error) console.error(e); } }

  function indul() {
    html.classList.add('js');
    biztos(mobilmenu);
    if (!csendes) html.classList.add('mozog');
    biztos(hos);   // a menü csökkentett mozgásnál is működik (ott azonnal, áttűnés nélkül vált)
    biztos(bemutato);
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
    var gepGombok = tomb(k.querySelectorAll('.gep-menu button'));   // a böngészőablak oldalsávja (csak egér/érintés)
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
      gepGombok.forEach(function (g, j) { g.classList.toggle('on', j === i); });
      akt = i;
    }
    function kattint(j) { return function () { k.classList.add('kiprobalta'); mutat(j); }; }
    gombok.forEach(function (g, j) { g.addEventListener('click', kattint(j)); });
    gepGombok.forEach(function (g, j) {
      g.addEventListener('click', kattint(j));
      g.addEventListener('mousedown', function (e) { e.preventDefault(); });   // ne kerüljön fókusz az aria-hidden gombra
    });
    if (gepGombok[0]) gepGombok[0].classList.add('on');
    k.classList.add('hos-kesz');   // csak most jelennek meg a gombok (ha valami elhasal, nem maradnak halott gombok)
    // egyszeri, szöveg nélküli jel (gyűrű a Dosszié ikonján), amikor a hős először látszik (csak mozgással; a CSS rejti, ha már kipróbálta)
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
    // a beakadás csak érintőképernyőn (telefon, tablet): egérrel (keskeny asztali ablakban is) marad a szabad görgetés
    var erintos = window.matchMedia('(hover: none) and (pointer: coarse)');

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
    // a görgetést jelző nyíl (csak keskeny nézetben látszik; a színpad aria-hidden, a nyíl nem fókuszálható)
    var nyil = d.createElement('span'); nyil.className = 'szinpad-nyil'; nyil.setAttribute('aria-hidden', 'true');
    kepTarto.appendChild(nyil);
    szinpad.appendChild(kepTarto); szinpad.appendChild(halado); szinpad.appendChild(szovegek);
    b.insertBefore(szinpad, b.firstChild);
    b.classList.add('szinpad-mod');

    // beakadási pontok (csak keskeny nézetben, érintőképernyőn számítanak, ld. stilus.css): lépésenként egy, a lista végén és a
    // szakasz tetején egy-egy
    function pont(szulo, nev) {
      var p = d.createElement('i'); p.className = 'beakado' + (nev ? ' ' + nev : ''); p.setAttribute('aria-hidden', 'true');
      szulo.appendChild(p); return p;
    }
    var pontok = lepesek.map(function (l) { return pont(l); });
    var pontKi = pont(lepesek[n - 1], 'beakado-ki');
    var szakasz = b.closest ? b.closest('section') : null;
    var pontBe = szakasz ? pont(szakasz, 'beakado-be') : pontok[0];

    var lista = b.querySelector('.blepesek');
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

    // beakadás (html.beakad) be/ki; horgony-linkre és fókuszváltásra rövid időre szabad (amíg az ugrás tart, utána újra számol)
    var beakad = false, szabad = false, szabadT = 0;
    function beallit(be) { if (be !== beakad) { beakad = be; html.classList.toggle('beakad', be); } }
    function elenged() { szabad = false; kerj(); }
    function szabadit(ms) { szabad = true; beallit(false); clearTimeout(szabadT); szabadT = setTimeout(elenged, ms || 800); }
    // a pont beakadási helye a mostani helyzethez képest (px): ennyit kell lefelé görgetni, hogy a pont a helyére érjen
    function tav(p) { return p.getBoundingClientRect().top - (parseFloat(window.getComputedStyle(p).scrollMarginTop) || 0); }

    function szamol() {
      keres = 0;
      var vh = window.innerHeight || html.clientHeight;
      var br = b.getBoundingClientRect();
      var tops = lepesek.map(function (l) { return l.getBoundingClientRect(); });
      var k = 0, toltes = [], kell = false;
      if (szeles.matches) {
        // gépen: az a lépés aktív, amelyiken a képernyő közepe áll
        var vonal = vh * 0.5;
        tops.forEach(function (r, j) {
          if (r.top <= vonal) k = j;
          toltes.push(korlat((vonal - r.top) / Math.max(1, r.height)));
        });
        // az utolsó szakasz akkor teljen be, amikor a színpad elenged (a lista alja eléri a színpad alját), ne csak a lépés végén:
        // eddig görgetett (a) + még hátralévő ragadás (m) = állandó, amíg a színpad ragad
        var a = vonal - tops[n - 1].top;
        var m = Math.max(0, lista.getBoundingClientRect().bottom - szinpad.getBoundingClientRect().bottom);
        toltes[n - 1] = a <= 0 ? 0 : korlat(a / Math.max(1, a + m));
      } else {
        // telefonon: a (láthatatlan) lépéslista a ragadós színpad alatt görög, lépésenként egy színpadnyi magas (CSS).
        // x: hány lépésnyit görgetett a lista a ragadás kezdete óta (j = a j. lépés beakadási pontja); a lépés a félútnál vált,
        // nyugalomban (a j. ponton) a haladásjelző első j + 1 szakasza teli
        var fent = parseFloat(window.getComputedStyle(szinpad).top) || 0;
        var lh = Math.max(1, n > 1 ? tops[1].top - tops[0].top : tops[0].height);
        var x = (fent - tops[0].top) / lh;
        k = Math.max(0, Math.min(n - 1, Math.round(x)));
        for (var j = 0; j < n; j++) toltes.push(korlat(x + 1 - j));
        // beakadás csak a szakasz teteje és a lista vége KÖZÖTT (a két szélső ponton már nem: onnan szabadon tovább lehet menni)
        kell = erintos.matches && tav(pontBe) < -3 && tav(pontKi) > 3;
      }
      beallit(kell && !szabad);
      szinpad.classList.toggle('vegen', k === n - 1);
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
    window.addEventListener('scroll', function () {
      if (szabad) { clearTimeout(szabadT); szabadT = setTimeout(elenged, 250); }   // amíg az ugrás görget, szabad marad
      kerj();
    }, { passive: true });
    d.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (a) szabadit();
    }, true);
    d.addEventListener('focusin', function () { szabadit(); });
    // érintésnél a szélső pontról (szakasz teteje, lista vége) a szakasz FELÉ induló húzás első mozdulatára már bekapcsol a
    // beakadás (ne csak az első görgetési kockán), hogy a legyintés végén biztosan a szomszéd lépésen álljon meg; a szakaszból
    // KIFELÉ induló húzásnál nem kapcsol be (ott szabad a görgetés). Csak passzív figyelők: a görgetést nem tartják fel.
    var erintY = null;
    d.addEventListener('touchstart', function (e) { erintY = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
    d.addEventListener('touchmove', function (e) {
      if (erintY === null || beakad || szabad || szeles.matches || !erintos.matches || e.touches.length !== 1) return;
      var dy = erintY - e.touches[0].clientY;   // > 0: lefelé görgetne
      if (Math.abs(dy) < 4) return;
      erintY = null;
      var be = tav(pontBe), ki = tav(pontKi);
      if ((dy > 0 && Math.abs(be) <= 3) || (dy < 0 && Math.abs(ki) <= 3)) beallit(true);
    }, { passive: true });
    d.addEventListener('touchend', function () { erintY = null; kerj(); }, { passive: true });
    window.addEventListener('hashchange', function () { szabadit(); });
    window.addEventListener('resize', kerj);
    [szeles, erintos].forEach(function (mq) {
      if (mq.addEventListener) mq.addEventListener('change', kerj); else if (mq.addListener) mq.addListener(kerj);
    });
    jelol(0);
    szamol();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', indul); else indul();
})();
