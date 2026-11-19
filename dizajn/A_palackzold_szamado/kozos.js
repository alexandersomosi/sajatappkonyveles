/* Számadó – közös rajzok: kézzel írt SVG-ikonok, gilos-keret, igazolványkép-hely, állapotsor, alsó sáv. Képet nem tölt be. */
(function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"';
  const W = 'fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  /* házikó kéménnyel */
  const HOUSE = 'M3.8 11.4 12 4.6l8.2 6.8v8.1c0 .7-.5 1.2-1.2 1.2h-4.4v-5.3H9.4v5.3H5c-.7 0-1.2-.5-1.2-1.2z';
  const CHIM = 'M16.2 7.9V4.8h2.3v5';
  /* dosszié: mappa, belőle kilóg egy lap */
  const PAPER = 'M6.6 8.4V4.6c0-.5.4-.9.9-.9h7.4l2.5 2.5v2.2';
  const FOLD = 'M3.4 9.4c0-.8.6-1.4 1.4-1.4h4.4l1.6 1.7h8.4c.8 0 1.4.6 1.4 1.4v7.6c0 .8-.6 1.4-1.4 1.4H4.8c-.8 0-1.4-.6-1.4-1.4z';
  /* üzenetek: két buborék, két ember beszél */
  const B1 = 'M14.6 8.6V5.8c0-.8-.6-1.4-1.4-1.4H4.6c-.8 0-1.4.6-1.4 1.4v5c0 .8.6 1.4 1.4 1.4h.6v2.4l2.6-2.2';
  const B2 = 'M10.4 9.4h8.6c.8 0 1.4.6 1.4 1.4v5c0 .8-.6 1.4-1.4 1.4h-.8v2.6l-3-2.6h-4.8c-.8 0-1.4-.6-1.4-1.4v-5c0-.8.6-1.4 1.4-1.4z';
  /* fiók: igazolvány fényképpel */
  const CARD = 'M5 5.6h14c.9 0 1.6.7 1.6 1.6v9.6c0 .9-.7 1.6-1.6 1.6H5c-.9 0-1.6-.7-1.6-1.6V7.2c0-.9.7-1.6 1.6-1.6z';
  const I = {
    home:     `<path ${S} d="${HOUSE}"/><path ${S} d="${CHIM}"/>`,
    homeOn:   `<path ${S} d="${CHIM}"/><path ${F} d="${HOUSE}"/>`,
    folder:   `<path ${S} d="${PAPER}"/><path ${S} d="${FOLD}"/>`,
    folderOn: `<path ${S} d="${PAPER}"/><path ${F} d="${FOLD}"/>`,
    chat:     `<path ${S} d="${B1}"/><path ${S} d="${B2}"/>`,
    chatOn:   `<path ${S} d="${B1}"/><path ${F} d="${B2}"/>`,
    person:   `<path ${S} d="${CARD}"/><circle ${S} cx="9" cy="10.4" r="1.9"/><path ${S} d="M5.9 15.2c.5-1.5 1.6-2.3 3.1-2.3s2.6.8 3.1 2.3M14.4 9.8h3.4M14.4 13h3.4"/>`,
    chev:     `<path ${S} stroke-width="2" d="M6.5 3.5 11 8l-4.5 4.5"/>`,
    back:     `<path ${S} stroke-width="2.2" d="M15 5.5 8.5 12l6.5 6.5"/>`,
    camera:   `<path ${S} d="M4 8.6c0-.9.7-1.6 1.6-1.6h2.2l1.5-2.2h5.4l1.5 2.2h2.2c.9 0 1.6.7 1.6 1.6v8.6c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6z"/><circle ${S} cx="12" cy="12.6" r="3.4"/>`,
    clip:     `<path ${S} d="M15.8 7.2 9 14c-.9.9-.9 2.2 0 3.1.9.9 2.2.9 3.1 0l7.2-7.2c1.7-1.7 1.7-4.3 0-6-1.7-1.7-4.3-1.7-6 0L5.8 11.4c-2.5 2.5-2.5 6.3 0 8.8s6.3 2.5 8.8 0l5.2-5.2"/>`,
    check:    `<path ${S} stroke-width="2.4" d="M6 12.5l4 4 8-9"/>`,
    copy:     `<rect ${S} x="8.6" y="8.6" width="11" height="11" rx="1.8"/><path ${S} d="M15.4 8.6V6.2c0-1-.8-1.8-1.8-1.8H6.2c-1 0-1.8.8-1.8 1.8v7.4c0 1 .8 1.8 1.8 1.8h2.4"/>`,
    clock:    `<circle ${S} stroke-width="2" cx="12" cy="12" r="7.4"/><path ${S} stroke-width="2" d="M12 7.8V12l2.8 1.8"/>`,
    finger:   `<g ${S} stroke-width="1.6"><path d="M4.6 8.4a8.6 8.6 0 0 1 14.8 0"/><path d="M6.2 18.6v-7a5.8 5.8 0 0 1 11.6 0v2.4"/><path d="M17.8 16.8v2.2"/><path d="M9.2 20.2v-8.4a2.8 2.8 0 0 1 5.6 0v4.4"/><path d="M14.8 19v1.4"/><path d="M12 12.2v8.2"/></g>`,
    cal:      `<rect ${S} x="4" y="5.6" width="16" height="14.4" rx="2"/><path ${S} d="M4 10h16M8.6 3.6v3.6M15.4 3.6v3.6"/>`,
    doc:      `<path ${S} d="M7 3.8h6.6l4.4 4.4v11.2c0 .5-.4.8-.8.8H7c-.5 0-.8-.3-.8-.8V4.6c0-.5.3-.8.8-.8z"/><path ${S} d="M13.4 3.8v4.6H18M9.2 12.6h5.6M9.2 15.8h5.6"/>`,
    upload:   `<path ${S} d="M12 15.6V4.8M7.6 9 12 4.6 16.4 9"/><path ${S} d="M4.6 14.4v3.8c0 .9.7 1.6 1.6 1.6h11.6c.9 0 1.6-.7 1.6-1.6v-3.8"/>`
  };
  window.ICON = I;
  const svg = (name, size, extra) =>
    `<svg viewBox="0 0 ${name === 'chev' ? 16 : 24} ${name === 'chev' ? 16 : 24}" width="${size}" height="${size}" aria-hidden="true" ${extra || ''}>${I[name]}</svg>`;
  window.svgIcon = svg;

  document.querySelectorAll('[data-i]').forEach(el => {
    const n = el.getAttribute('data-i'); const s = el.getAttribute('data-s') || 24;
    el.outerHTML = svg(n, s, el.getAttribute('class') ? `class="${el.getAttribute('class')}"` : '');
  });

  /* a könyvelő igazolványképének helye: élesben Bence valódi fotója kerül ide (nem AI-kép, nem rajz) */
  document.querySelectorAll('.arckep').forEach(el => {
    el.setAttribute('role', 'img'); if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Kovács Bence fotója');
    el.innerHTML = `<svg viewBox="0 0 40 50" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="40" height="50" fill="#C9D4CE"/>
      <path d="M2 50c1.2-9.6 7.6-14.2 18-14.2S36.8 40.4 38 50z" fill="#A7B8B0"/>
      <ellipse cx="20" cy="21.4" rx="8" ry="9.6" fill="#A7B8B0"/></svg>`;
  });

  /* állapotsor */
  document.querySelectorAll('.sb').forEach(el => {
    el.innerHTML = `<span>9:41</span><span style="display:flex;gap:7px;align-items:center">
      <svg width="18" height="12" viewBox="0 0 18 12"><g fill="currentColor"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.5" width="3" height="6.5" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8"/></g></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".75" y=".75" width="22.5" height="11.5" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".45"/><rect x="2.6" y="2.6" width="18.8" height="7.8" rx="1.8" fill="currentColor"/><path d="M24.8 4.4v4.2c.9-.3 1.4-1.1 1.4-2.1s-.5-1.8-1.4-2.1z" fill="currentColor" opacity=".45"/></svg></span>`;
  });

  /* alsó sáv */
  document.querySelectorAll('nav.tabbar').forEach(nav => {
    const on = nav.getAttribute('data-on');
    const tabs = [['fooldal', 'Főoldal', 'home'], ['dosszie', 'Dosszié', 'folder'], ['uzenetek', 'Üzenetek', 'chat'], ['fiok', 'Fiók', 'person']];
    nav.innerHTML = tabs.map(([k, t, ic]) => {
      const isOn = k === on; const icon = isOn && I[ic + 'On'] ? ic + 'On' : ic;
      return `<a class="tab${isOn ? ' on' : ''}">${svg(icon, 26)}${t}</a>`;
    }).join('');
    const hb = document.createElement('div'); hb.className = 'homebar'; document.body.appendChild(hb);
  });

  /* gilos-keret: egymásba fonódó szálak körbe a kivonat szélén, mint egy értékpapír szegélye.
     A középvonal egy lekerekített téglalap (beljebb m px-szel, sarka rc); a szálak ennek normálisa mentén térnek ki:
     eltérés_i(s) = A(s)·sin(2πs/p + i·2π/n),  A(s) = a0 + a1·cos(2πs/p),  p = kerület / N (egész számú hullám, így körben zár). */
  window.guillocheFrame = function (el, opt) {
    const o = Object.assign({ m: 10, rc: 8, n: 10, per: 21, a0: 4.1, a1: 2.1, col: '#4F8A70', sw: 0.6, fw: 0.8, fo: 7.6 }, opt || {});
    const box = el.parentElement.getBoundingClientRect(); const w = box.width, h = box.height;
    if (!w || !h) return;
    const Wd = w - 2 * o.m, Hd = h - 2 * o.m, r = o.rc, sx = Wd - 2 * r, sy = Hd - 2 * r, arc = Math.PI * r / 2;
    const P = 2 * sx + 2 * sy + 4 * arc, N = Math.max(8, Math.round(P / o.per)), per = P / N;
    const at = s => {
      s = ((s % P) + P) % P; let a;
      if (s < sx) return [o.m + r + s, o.m, 0, -1]; s -= sx;
      if (s < arc) { a = -Math.PI / 2 + s / r; return [o.m + r + sx + r * Math.cos(a), o.m + r + r * Math.sin(a), Math.cos(a), Math.sin(a)]; } s -= arc;
      if (s < sy) return [w - o.m, o.m + r + s, 1, 0]; s -= sy;
      if (s < arc) { a = s / r; return [o.m + r + sx + r * Math.cos(a), o.m + r + sy + r * Math.sin(a), Math.cos(a), Math.sin(a)]; } s -= arc;
      if (s < sx) return [o.m + r + sx - s, h - o.m, 0, 1]; s -= sx;
      if (s < arc) { a = Math.PI / 2 + s / r; return [o.m + r + r * Math.cos(a), o.m + r + sy + r * Math.sin(a), Math.cos(a), Math.sin(a)]; } s -= arc;
      if (s < sy) return [o.m, o.m + r + sy - s, -1, 0]; s -= sy;
      a = Math.PI + s / r; return [o.m + r + r * Math.cos(a), o.m + r + r * Math.sin(a), Math.cos(a), Math.sin(a)];
    };
    let out = '';
    const steps = Math.ceil(P / 0.9);
    for (let i = 0; i < o.n; i++) {
      const ph = i * 2 * Math.PI / o.n; let d = '';
      for (let k = 0; k <= steps; k++) {
        const s = k * P / steps; const [x, y, nx, ny] = at(s);
        const A = o.a0 + o.a1 * Math.cos(2 * Math.PI * s / per);
        const off = A * Math.sin(2 * Math.PI * s / per + ph);
        d += (k ? 'L' : 'M') + (x + nx * off).toFixed(2) + ' ' + (y + ny * off).toFixed(2);
      }
      out += `<path d="${d}Z"/>`;
    }
    const rr = (ins, rad) => `<rect x="${ins}" y="${ins}" width="${(w - 2 * ins).toFixed(2)}" height="${(h - 2 * ins).toFixed(2)}" rx="${rad}" stroke-width="${o.fw}"/>`;
    el.setAttribute('viewBox', `0 0 ${w} ${h}`);
    el.innerHTML = `<g fill="none" stroke="${o.col}" stroke-width="${o.sw}">${out}${rr(o.m - o.fo, r + o.fo)}${rr(o.m + o.fo, Math.max(r - o.fo, 0.5))}</g>`;
  };
  const frames = () => document.querySelectorAll('svg.keret').forEach(s => window.guillocheFrame(s, JSON.parse(s.getAttribute('data-opt') || '{}')));
  frames(); if (document.fonts) document.fonts.ready.then(frames);

  /* teljes hosszú kép (#full): a sáv a dokumentum aljára kerül, a magasság a body data-h attribútumába */
  if (location.hash === '#full') document.body.classList.add('full');
  const setH = () => document.body.setAttribute('data-h', Math.ceil(document.documentElement.scrollHeight));
  setH(); if (document.fonts) document.fonts.ready.then(() => { setH(); document.body.setAttribute('data-fonts', [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).join('|')); });
})();
