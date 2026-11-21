// SPEC §31 – the adozz.hu page script (build.mjs makes dist/js/meres.js of it; the channel rule is copied in from
// kod/shared/src/marketing.ts, so the page, the app, the backend and the panel group the same way).
// What it does (no cookie, nothing stored on the device unless the visitor asks for it):
//  1. The links to the app (Regisztrálok, Belépés, Visszahívást kérek) take the utm_* of this address, the referring
//     domain and the landing path along – in the link only (the app sends them with the sign-up).
//  2. The statistics (our own Umami server, /m/…): THIS script loads /m/script.js, after the filter below is in place –
//     so the statistics never run unfiltered. They get the channel as the visit's tag, and an address without any click id
//     or other parameter (only utm_*). The referrer is cut to its site (origin).
//  3. "Görgetett az árakig" once per page view; the Regisztrálok / Belépés / Visszahívás / e-mail clicks (data-kj-esemeny)
//     are sent with umami.track WITHOUT waiting (keepalive request): a slow statistics server never holds a button.
//  4. "Ne mérjétek a látogatásomat": the statistics script's own off switch (localStorage umami.disabled), only on request.
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

  // ---- 2. the statistics: channel as the tag, a clean address; the script is loaded below, after the filter ----
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

  if (CFG.stat && CFG.stat.websiteId) {
    var st = document.createElement('script');
    st.defer = true;
    st.src = '/m/script.js';
    st.setAttribute('data-website-id', CFG.stat.websiteId);
    st.setAttribute('data-domains', CFG.stat.domains);
    st.setAttribute('data-before-send', 'adozzStatSzuro');
    st.setAttribute('data-tag', csatorna);
    if (CFG.stat.dnt) st.setAttribute('data-do-not-track', 'true');
    (document.head || document.documentElement).appendChild(st);
  }

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

  // ---- 3b. the button clicks: sent without waiting (the link opens at once) ----
  function kattintasok() {
    document.addEventListener(
      'click',
      function (e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-kj-esemeny]') : null;
        if (!el || !window.umami || typeof window.umami.track !== 'function') return;
        var hely = el.getAttribute('data-kj-hely');
        try {
          var p = window.umami.track(el.getAttribute('data-kj-esemeny'), hely ? { hely: hely } : undefined);
          if (p && typeof p.catch === 'function') p.catch(function () {});
        } catch (err) {
          /* the statistics never break a button */
        }
      },
      true,
    );
  }

  // ---- 4. the visitor's own off switch for the statistics ----
  function meresKapcsolo() {
    var gomb = document.getElementById('meres-kapcsolo');
    if (!gomb || !CFG.stat) return;
    var visszajelzes = document.getElementById('meres-visszajelzes');
    var ki = function () {
      try {
        return Boolean(window.localStorage.getItem('umami.disabled'));
      } catch (e) {
        return false;
      }
    };
    var felirat = function () {
      gomb.textContent = ki() ? CFG.szoveg.ujraMerheto : CFG.szoveg.neMerjetek;
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
      if (visszajelzes) visszajelzes.textContent = ki() ? CFG.szoveg.kesz : '';
    });
  }

  /*__HIRDETES__*/

  function indul() {
    linkekAtirasa();
    arakFigyelese();
    kattintasok();
    meresKapcsolo();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indul);
  else indul();
})();
