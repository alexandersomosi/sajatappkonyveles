  // ===================================================================================================================
  // SPEC §31.6 – ad measurement. Only in a build with "hirdetes": true (meres.json), and even then nothing happens until
  // the server answers { ads: true } (ADS_TRACKING_ENABLED=true with keys). Before the visitor decides: no Meta or
  // Google script, no request to them, no cookie except the choice itself. "Elfogadom" and "Elutasítom" are equal
  // buttons; "Beállítások" per partner, all off by default; the choice can be changed any time ("Süti-beállítások").
  // ===================================================================================================================
  (function () {
    var SUTI = 'kj_hozzajarulas';
    var hj = null;
    var srv = null;
    var ablakEl = null;

    function olvas() {
      var m = ('; ' + document.cookie).split('; ' + SUTI + '=')[1];
      if (!m) return null;
      try {
        var p = new URLSearchParams(decodeURIComponent(m.split(';')[0]));
        return { v: p.get('v') || '', id: p.get('id') || '', m: p.get('m') === '1', g: p.get('g') === '1', p: p.get('p') === '1' };
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
      p.set('p', d.p ? '1' : '0');
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
    function googleBetolt(tag, szemelyre) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      if (!googleKesz) {
        window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
      }
      window.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: szemelyre ? 'granted' : 'denied', analytics_storage: 'denied' });
      if (googleKesz) return;
      googleKesz = true;
      window.gtag('js', new Date());
      window.gtag('config', tag);
      szkript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(tag));
    }
    function alkalmaz() {
      if (!hj || !srv) return;
      if (hj.m && srv.metaPixelId) metaBetolt(srv.metaPixelId);
      if (hj.g && srv.googleTagId) googleBetolt(srv.googleTagId, hj.p);
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
    function dont(meta, google, szemelyre) {
      var elozo = hj && hj.id ? hj.id : undefined;
      var visszavon = Boolean(hj && ((hj.m && !meta) || (hj.g && !google) || (hj.p && !szemelyre)));
      fetch('/api/v1/public/hozzajarulas', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ meta: meta, google: google, personalization: szemelyre, previous: elozo }),
      })
        .then(function (r) {
          return r.ok ? r.json() : { id: null };
        })
        .catch(function () {
          return { id: null };
        })
        .then(function (b) {
          var id = b && b.id ? String(b.id) : '';
          hj = { v: srv.noticeVersion, id: id, m: Boolean(id && meta), g: Boolean(id && google), p: Boolean(id && google && szemelyre) };
          ir(hj);
          if (visszavon) {
            hirdetesiSutikTorlese();
            if (window.gtag) window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
            if (window.fbq) window.fbq('consent', 'revoke');
          }
          ablakBezar();
          alkalmaz();
          linkekAtirasa();
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
      var partnerek = [srv.metaPixelId ? 'a Meta (Facebook, Instagram)' : '', srv.googleTagId ? 'a Google' : ''].filter(Boolean).join(' és ');
      var d = el('section', 'hj-ablak');
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-label', 'Sütik és hirdetésmérés');
      d.appendChild(el('h2', '', 'Sütik és hirdetésmérés'));
      d.appendChild(
        el(
          'p',
          '',
          'Ha elfogadod, ' + partnerek + ' sütijeivel mérjük, melyik hirdetésünk működik, és a regisztrációdat álnevesített (hash-elt) e-mail-címmel jelezzük nekik. Az adatok az Egyesült Államokba is kerülhetnek. Ha elutasítod, az oldal és a regisztráció ugyanúgy működik.',
        ),
      );
      var linkek = el('p', 'hj-linkek');
      var l1 = el('a', '', 'Süti-tájékoztató');
      l1.href = CFG.app + '/jogi/suti';
      var l2 = el('a', '', 'Adatkezelési tájékoztató');
      l2.href = CFG.app + '/jogi/adatkezeles';
      linkek.appendChild(l1);
      linkek.appendChild(document.createTextNode(' · '));
      linkek.appendChild(l2);
      d.appendChild(linkek);
      var beall = el('div', 'hj-beallitasok');
      beall.hidden = true;
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
      doboz('m', 'Meta (Facebook, Instagram): hirdetésmérés', Boolean(srv.metaPixelId));
      doboz('g', 'Google: hirdetésmérés', Boolean(srv.googleTagId));
      doboz('p', 'Google: személyre szabott hirdetések', Boolean(srv.googleTagId));
      var ment = el('button', 'hj-gomb', 'Mentem a választásomat');
      ment.type = 'button';
      ment.addEventListener('click', function () {
        var v = { m: false, g: false, p: false };
        dobozok.forEach(function (c) {
          v[c.getAttribute('data-kulcs')] = c.checked;
        });
        dont(v.m, v.g, v.g && v.p);
      });
      beall.appendChild(ment);
      var gombok = el('div', 'hj-gombok');
      var elfogad = el('button', 'hj-gomb', 'Elfogadom');
      elfogad.type = 'button';
      elfogad.addEventListener('click', function () {
        dont(Boolean(srv.metaPixelId), Boolean(srv.googleTagId), false);
      });
      var elutasit = el('button', 'hj-gomb', 'Elutasítom');
      elutasit.type = 'button';
      elutasit.addEventListener('click', function () {
        dont(false, false, false);
      });
      var beallGomb = el('button', 'hj-szoveg-gomb', 'Beállítások');
      beallGomb.type = 'button';
      beallGomb.addEventListener('click', function () {
        beall.hidden = !beall.hidden;
      });
      gombok.appendChild(elfogad);
      gombok.appendChild(elutasit);
      gombok.appendChild(beallGomb);
      d.appendChild(gombok);
      d.appendChild(beall);
      document.body.appendChild(d);
      ablakEl = d;
    }
    fetch('/api/v1/public/marketing-config', { credentials: 'omit' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (c) {
        if (!c || c.ads !== true) return;
        srv = c;
        hj = olvas();
        if (hj && hj.v === c.noticeVersion) {
          alkalmaz();
          linkekAtirasa();
        } else {
          hj = null;
          ablak();
        }
        var b = document.getElementById('suti-beallitasok');
        if (b) {
          b.hidden = false;
          b.addEventListener('click', ablak);
        }
      })
      .catch(function () {
        /* no config: nothing loads */
      });
  })();
