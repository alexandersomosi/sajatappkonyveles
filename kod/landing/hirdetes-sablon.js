  // ===================================================================================================================
  // SPEC §31.6 – ad measurement. Only in a build with "hirdetes": true (meres.json), and even then nothing happens until
  // the server answers { ads: true } (ADS_TRACKING_ENABLED=true with keys). Before the visitor decides: no Meta or
  // Google script, no request to them, no cookie except the choice itself. "Elfogadom" and "Elutasítom" are equal
  // buttons, none focused in advance; "Beállítások" per partner, all off by default; the choice can be changed any time
  // ("Süti-beállítások"). Every visible text comes from kod/jogi/app_szovegek.json (CFG.sutiAblak, the lawyer's copy).
  // No personalised ads / remarketing: ad_personalization is always "denied" (Adatkezelési tájékoztató 2.18.).
  // A stored decision is checked with the server at every visit: withdrawn in the app, older than 180 days or of an older
  // notice version → the ad cookies are deleted and the banner asks again.
  // ===================================================================================================================
  (function () {
    var SUTI = 'kj_hozzajarulas';
    var SZ = CFG.sutiAblak || {};
    var hj = null;
    var srv = null;
    var ablakEl = null;

    function olvas() {
      var m = ('; ' + document.cookie).split('; ' + SUTI + '=')[1];
      if (!m) return null;
      try {
        var p = new URLSearchParams(decodeURIComponent(m.split(';')[0]));
        return { v: p.get('v') || '', id: p.get('id') || '', m: p.get('m') === '1', g: p.get('g') === '1' };
      } catch (e) {
        return null;
      }
    }
    function ir(d) {
      var p = new URLSearchParams();
      p.set('v', d.v);
      if (d.id) p.set('id', d.id);
      p.set('m', d.m ? '1' : '0');
      p.set('g', d.g ? '1' : '0');
      // the visitor's choice only (strictly necessary); 180 days, then we ask again
      document.cookie = SUTI + '=' + encodeURIComponent(p.toString()) + '; Path=/; Max-Age=' + 180 * 86400 + '; SameSite=Lax; Secure';
    }
    function hirdetesiSutikTorlese() {
      ['_fbp', '_fbc', '_gcl_au', '_gcl_aw', '_gcl_gb', '_gcl_dc'].forEach(function (n) {
        document.cookie = n + '=; Path=/; Max-Age=0';
        document.cookie = n + '=; Path=/; Max-Age=0; Domain=.' + loc.hostname.replace(/^www\./, '');
      });
    }
    function szkript(src) {
      var s = document.createElement('script');
      s.async = true;
      s.src = src;
      document.head.appendChild(s);
    }
    var metaKesz = false;
    function metaBetolt(id) {
      if (metaKesz) return;
      metaKesz = true;
      // the Meta base code (fbq queue), without the noscript pixel; no automatic events
      var n = (window.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      });
      if (!window._fbq) window._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      window.fbq('set', 'autoConfig', false, id);
      window.fbq('init', id);
      window.fbq('track', 'PageView');
      szkript('https://connect.facebook.net/en_US/fbevents.js');
    }
    var googleKesz = false;
    function googleBetolt(tag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      if (!googleKesz) {
        window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
      }
      // measurement only: no personalised ads, no remarketing (2.18.)
      window.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied', analytics_storage: 'denied' });
      if (googleKesz) return;
      googleKesz = true;
      window.gtag('js', new Date());
      window.gtag('config', tag);
      szkript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(tag));
    }
    function alkalmaz() {
      if (!hj || !srv) return;
      if (hj.m && srv.metaPixelId) metaBetolt(srv.metaPixelId);
      if (hj.g && srv.googleTagId) googleBetolt(srv.googleTagId);
    }
    // the app links carry the decision id and the click ids only after "Elfogadom"
    hirdetesiParameterek = function () {
      if (!hj || !hj.id || (!hj.m && !hj.g)) return null;
      var o = new URLSearchParams();
      o.set(SOURCE_PARAM_CONSENT, hj.id);
      AD_CLICK_ID_PARAMS.forEach(function (k) {
        var v = q.get(k);
        if (v) o.set(k, v.slice(0, 500));
      });
      return o;
    };
    function visszavonasHelyben() {
      hirdetesiSutikTorlese();
      if (window.gtag) window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      if (window.fbq) window.fbq('consent', 'revoke');
    }
    function dont(meta, google, uzenet) {
      var elozo = hj && hj.id ? hj.id : undefined;
      var visszavon = Boolean(hj && ((hj.m && !meta) || (hj.g && !google)));
      var body = { meta: meta, google: google };
      if (elozo) body.previous = elozo;
      fetch('/api/v1/public/hozzajarulas', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.ok ? r.json() : { id: null };
        })
        .catch(function () {
          return { id: null };
        })
        .then(function (b) {
          var id = b && b.id ? String(b.id) : '';
          hj = { v: srv.noticeVersion, id: id, m: Boolean(id && meta), g: Boolean(id && google) };
          ir(hj);
          if (visszavon) visszavonasHelyben();
          ablakBezar();
          alkalmaz();
          linkekAtirasa();
          var vj = document.getElementById('meres-visszajelzes');
          if (uzenet && vj && SZ.mentve) vj.textContent = SZ.mentve;
        });
    }
    function el(tag, osztaly, szoveg) {
      var e = document.createElement(tag);
      if (osztaly) e.className = osztaly;
      if (szoveg) e.textContent = szoveg;
      return e;
    }
    function ablakBezar() {
      if (ablakEl && ablakEl.parentNode) ablakEl.parentNode.removeChild(ablakEl);
      ablakEl = null;
    }
    function ablak() {
      ablakBezar();
      var d = el('section', 'hj-ablak');
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-label', SZ.cim);
      d.appendChild(el('h2', '', SZ.cim));
      d.appendChild(el('p', '', SZ.szoveg));
      var linkek = el('p', 'hj-linkek');
      var l1 = el('a', '', SZ.link_suti);
      l1.href = CFG.app + '/jogi/suti';
      var l2 = el('a', '', SZ.link_adatkezeles);
      l2.href = CFG.app + '/jogi/adatkezeles';
      linkek.appendChild(l1);
      linkek.appendChild(document.createTextNode(' · '));
      linkek.appendChild(l2);
      d.appendChild(linkek);
      var beall = el('div', 'hj-beallitasok');
      beall.hidden = true;
      beall.appendChild(el('h3', 'hj-beall-cim', SZ.beallitasok_cim));
      beall.appendChild(el('p', 'hj-kicsi', SZ.beallitasok_bevezeto));
      // the strictly necessary storage: information only, no switch
      beall.appendChild(el('p', 'hj-kicsi hj-szukseges', SZ.szukseges));
      var dobozok = [];
      function doboz(kulcs, szoveg, van) {
        if (!van) return;
        var lab = el('label', 'hj-doboz');
        var c = document.createElement('input');
        c.type = 'checkbox';
        c.checked = Boolean(hj && hj[kulcs]);
        c.setAttribute('data-kulcs', kulcs);
        lab.appendChild(c);
        lab.appendChild(document.createTextNode(' ' + szoveg));
        beall.appendChild(lab);
        dobozok.push(c);
      }
      doboz('m', SZ.meta, Boolean(srv.metaPixelId));
      doboz('g', SZ.google, Boolean(srv.googleTagId));
      var ment = el('button', 'hj-gomb', SZ.mentes);
      ment.type = 'button';
      ment.addEventListener('click', function () {
        var v = { m: false, g: false };
        dobozok.forEach(function (c) {
          v[c.getAttribute('data-kulcs')] = c.checked;
        });
        dont(v.m, v.g, true);
      });
      beall.appendChild(ment);
      var gombok = el('div', 'hj-gombok');
      var elfogad = el('button', 'hj-gomb', SZ.elfogadom);
      elfogad.type = 'button';
      elfogad.addEventListener('click', function () {
        dont(Boolean(srv.metaPixelId), Boolean(srv.googleTagId), true);
      });
      var elutasit = el('button', 'hj-gomb', SZ.elutasitom);
      elutasit.type = 'button';
      elutasit.addEventListener('click', function () {
        dont(false, false, true);
      });
      var beallGomb = el('button', 'hj-szoveg-gomb', SZ.beallitasok);
      beallGomb.type = 'button';
      beallGomb.setAttribute('aria-expanded', 'false');
      beallGomb.addEventListener('click', function () {
        beall.hidden = !beall.hidden;
        beallGomb.setAttribute('aria-expanded', beall.hidden ? 'false' : 'true');
      });
      gombok.appendChild(elfogad);
      gombok.appendChild(elutasit);
      gombok.appendChild(beallGomb);
      d.appendChild(gombok);
      d.appendChild(beall);
      document.body.appendChild(d);
      ablakEl = d;
    }
    function lablecGomb() {
      var lab = document.getElementById('meres-lablec');
      if (lab && CFG.hirdetesLablec) lab.textContent = CFG.hirdetesLablec;
      var b = document.getElementById('suti-beallitasok');
      if (b) {
        b.hidden = false;
        b.addEventListener('click', ablak);
      }
    }
    fetch('/api/v1/public/marketing-config', { credentials: 'omit' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (c) {
        if (!c || c.ads !== true) return;
        srv = c;
        lablecGomb();
        var tarolt = olvas();
        if (!tarolt || tarolt.v !== c.noticeVersion) {
          if (tarolt && (tarolt.m || tarolt.g)) hirdetesiSutikTorlese();
          hj = null;
          ablak();
          return;
        }
        if (!tarolt.id || (!tarolt.m && !tarolt.g)) {
          // a refusal: nothing to check, nothing loads
          hj = tarolt;
          return;
        }
        // an "Elfogadom": still valid on the server? (withdrawn in the app, too old, other notice version → ask again)
        fetch('/api/v1/public/hozzajarulas/' + encodeURIComponent(tarolt.id), { credentials: 'omit' })
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .catch(function () {
            return null;
          })
          .then(function (v) {
            if (v && v.ervenyes === true) {
              hj = tarolt;
              alkalmaz();
              linkekAtirasa();
            } else {
              hirdetesiSutikTorlese();
              hj = null;
              ablak();
            }
          });
      })
      .catch(function () {
        /* no config: nothing loads */
      });
  })();
