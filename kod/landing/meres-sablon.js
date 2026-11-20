// SPEC §31 – the adozz.hu page script (build.mjs makes dist/js/meres.js of it; the channel rule is copied in from
// kod/shared/src/marketing.ts, so the page, the app, the backend and the panel group the same way).
// What it does (no cookie, nothing stored on the device unless the visitor asks for it):
//  1. The links to the app (Regisztrálok, Belépés, Visszahívást kérek) take the utm_* of this address, the referring
//     domain and the landing path along – in the link only (the app sends them with the sign-up).
//  2. The statistics (our own Umami server, /m/…) get the channel as the visit's tag, and an address without any
//     click id or other parameter (only utm_*). The referrer is cut to its domain.
//  3. "Görgetett az árakig" once per page view. The Regisztrálok / Belépés / Visszahívás / e-mail clicks are counted by
//     the statistics script itself (data-umami-event attributes in the page).
//  4. "Kikapcsolom a mérést": the statistics script's own off switch (localStorage umami.disabled), only on request.
//  5. Ad measurement (Meta / Google): ONLY in a build with "hirdetes": true in meres.json AND with the server switched on
//     (/api/v1/public/marketing-config). Otherwise that code is not even in this file.
(function () {
  'use strict';
  var CFG = /*__CFG__*/ {};
  /*__SHARED__*/

  var loc = window.location;
  var q;
  try {
    q = new URLSearchParams(loc.search);
  } catch (e) {
    q = new URLSearchParams('');
  }
  var refDomain = null;
  try {
    refDomain = normalizeDomain(document.referrer || '');
    if (refDomain && isOwnDomain(refDomain, CFG.own)) refDomain = null;
  } catch (e) {
    refDomain = null;
  }
  var csatorna = channelOf({ utmSource: q.get('utm_source'), referrerDomain: refDomain }, CFG.own);

  // ---- 2. the statistics: channel as the tag, a clean address (read by /m/script.js, which runs after this file) ----
  window.umamiConfig = { tag: csatorna };
  window.adozzStatSzuro = function (type, payload) {
    if (!payload || typeof payload !== 'object') return payload;
    var p = {};
    for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) p[k] = payload[k];
    if (typeof p.url === 'string') p.url = statisticsUrl(p.url, loc.href);
    if (typeof p.referrer === 'string' && p.referrer) {
      try {
        var r = new URL(p.referrer, loc.href);
        p.referrer = r.origin === loc.origin ? r.pathname : r.origin + '/';
      } catch (e) {
        p.referrer = '';
      }
    }
    return p;
  };

  // ---- 1. the links to the app ----
  var hirdetesiParameterek = function () {
    return null;
  };
  function atadando() {
    var out = new URLSearchParams();
    UTM_KEYS.forEach(function (k) {
      var v = q.get('utm_' + k);
      if (v) out.set('utm_' + k, v.slice(0, 100));
    });
    if (refDomain) out.set(SOURCE_PARAM_REFERRER, refDomain);
    out.set(SOURCE_PARAM_LANDING, loc.pathname || '/');
    var h = hirdetesiParameterek();
    if (h) h.forEach(function (v, k) {
      out.set(k, v);
    });
    return out;
  }
  function linkekAtirasa() {
    var a = document.querySelectorAll('a[href^="' + CFG.app + '/"]');
    var add = atadando();
    for (var i = 0; i < a.length; i++) {
      var el = a[i];
      if (/\/jogi\//.test(el.getAttribute('href') || '')) continue; // the legal pages need no source
      try {
        var u = new URL(el.getAttribute('data-alap-href') || el.href);
        if (!el.getAttribute('data-alap-href')) el.setAttribute('data-alap-href', u.toString());
        add.forEach(function (v, k) {
          if (!u.searchParams.has(k)) u.searchParams.set(k, v);
        });
        el.href = u.toString();
      } catch (e) {
        /* the link stays as it was */
      }
    }
  }

  // ---- 3. scrolled to the prices ----
  function arakFigyelese() {
    var arak = document.getElementById('arak');
    if (!arak || typeof IntersectionObserver === 'undefined') return;
    var kesz = false;
    var io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) {
        if (es[i].isIntersecting && !kesz) {
          kesz = true;
          io.disconnect();
          var probal = function (n) {
            if (window.umami && typeof window.umami.track === 'function') window.umami.track(CFG.esemenyArak);
            else if (n > 0) setTimeout(function () { probal(n - 1); }, 1000);
          };
          probal(5);
        }
      }
    }, { threshold: 0.25 });
    io.observe(arak);
  }

  // ---- 4. the visitor's own off switch for the statistics ----
  function meresKapcsolo() {
    var gomb = document.getElementById('meres-kapcsolo');
    if (!gomb || !CFG.stat) return;
    var ki = function () {
      try {
        return Boolean(window.localStorage.getItem('umami.disabled'));
      } catch (e) {
        return false;
      }
    };
    var felirat = function () {
      gomb.textContent = ki() ? 'Újra mérhetitek a látogatásomat' : 'Ne mérjétek a látogatásomat';
    };
    gomb.hidden = false;
    felirat();
    gomb.addEventListener('click', function () {
      try {
        if (ki()) window.localStorage.removeItem('umami.disabled');
        else window.localStorage.setItem('umami.disabled', '1');
      } catch (e) {
        /* blocked storage: nothing to switch */
      }
      felirat();
    });
  }

  /*__HIRDETES__*/

  function indul() {
    linkekAtirasa();
    arakFigyelese();
    meresKapcsolo();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indul);
  else indul();
})();
