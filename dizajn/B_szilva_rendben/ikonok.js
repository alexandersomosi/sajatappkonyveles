/* Rendben: kézzel rajzolt ikonok, 24 px-es rácson, 1,7 px-es vonallal.
   Használat: <svg class="ikon"><use href="#i-haz"/></svg>
   Az arckép-helyőrző (i-portre) kitöltött rajz, nem vonalikon: <svg class="portre"><use href="#i-portre"/></svg> */
(function () {
  var I = {
    'haz': '<path d="M4 10.4 12 4l8 6.4V19.5a1 1 0 0 1-1 1h-4.6v-5.6H9.6v5.6H5a1 1 0 0 1-1-1z"/>',
    'dosszie': '<path d="M3.5 6.2A1.2 1.2 0 0 1 4.7 5h4.6l1.9 2.3h8.1a1.2 1.2 0 0 1 1.2 1.2v10.3a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2z"/><path d="M3.5 10.3h17"/>',
    'uzenet': '<path d="M5.2 4.5h13.6a1.7 1.7 0 0 1 1.7 1.7v9a1.7 1.7 0 0 1-1.7 1.7h-8.1L6.4 20.3v-3.4H5.2a1.7 1.7 0 0 1-1.7-1.7v-9a1.7 1.7 0 0 1 1.7-1.7z"/>',
    'fiok': '<circle cx="12" cy="8.6" r="3.6"/><path d="M4.8 20.2c.9-3.7 3.7-5.6 7.2-5.6s6.3 1.9 7.2 5.6"/>',
    'nyil-j': '<path d="M9.5 5.8 15.7 12l-6.2 6.2"/>',
    'nyil-b': '<path d="M14.5 5.8 8.3 12l6.2 6.2"/>',
    'kamera': '<path d="M4.6 7.8h3l1.5-2.3h5.8l1.5 2.3h3a1.1 1.1 0 0 1 1.1 1.1v9.5a1.1 1.1 0 0 1-1.1 1.1H4.6a1.1 1.1 0 0 1-1.1-1.1V8.9a1.1 1.1 0 0 1 1.1-1.1z"/><circle cx="12" cy="13.3" r="3.4"/>',
    'dok': '<path d="M6.8 3.5h7l4.4 4.4v12a.6.6 0 0 1-.6.6H6.8a.6.6 0 0 1-.6-.6V4.1a.6.6 0 0 1 .6-.6z"/><path d="M13.6 3.6v4.5h4.5"/><path d="M9 12.2h6M9 15.3h6M9 18.2h3.6"/>',
    'dok-pipa': '<path d="M6.8 3.5h7l4.4 4.4v12a.6.6 0 0 1-.6.6H6.8a.6.6 0 0 1-.6-.6V4.1a.6.6 0 0 1 .6-.6z"/><path d="M13.6 3.6v4.5h4.5"/><path d="m9 14.6 2.2 2.2 4-4.4"/>',
    'csatol': '<path d="m15.6 7.4-6.4 6.5a1.8 1.8 0 0 0 2.6 2.6l6.5-6.6a3.4 3.4 0 0 0-4.8-4.8l-6.7 6.8a5 5 0 0 0 7.1 7.1l5.6-5.7"/>',
    'kuld': '<path d="M12 19V5.6"/><path d="m6.6 11 5.4-5.4 5.4 5.4"/>',
    'naptar': '<rect x="3.8" y="5.4" width="16.4" height="14.8" rx="1.8"/><path d="M3.8 9.8h16.4M8.4 3.4v4M15.6 3.4v4"/>',
    'pipa': '<path d="m5.6 12.6 4.1 4.1 8.7-9.4"/>',
    'kor-pipa': '<circle cx="12" cy="12" r="8.6"/><path d="m8.3 12.3 2.6 2.6 4.9-5.3"/>',
    'plusz': '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
    'ora': '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l2.9 1.9"/>',
    'letolt': '<path d="M12 4.2v10.6"/><path d="m7.6 10.6 4.4 4.4 4.4-4.4"/><path d="M5 19.4h14"/>',
    'nagyit': '<circle cx="10.6" cy="10.6" r="6"/><path d="m15 15 5 5"/>',
    'masol': '<rect x="8.6" y="8.6" width="11.4" height="11.4" rx="1.8"/><path d="M15.4 8.6V5.8A1.8 1.8 0 0 0 13.6 4H5.8A1.8 1.8 0 0 0 4 5.8v7.8a1.8 1.8 0 0 0 1.8 1.8h2.8"/>',
    'szem': '<path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z"/><circle cx="12" cy="12" r="2.7"/>',
    'ujj': '<path d="M4.2 16.4A8.4 8.4 0 1 1 19.8 16.4"/><path d="M7.6 19.6A5.6 5.6 0 0 1 6.4 13a5.6 5.6 0 0 1 11.2 0v2.4"/><path d="M9.6 21.2V13.2a2.4 2.4 0 0 1 4.8 0v2.6c0 1.6.5 3.1 1.3 4.4"/>',
    'boritek': '<rect x="3.5" y="5.8" width="17" height="12.4" rx="1.4"/><path d="m4.2 6.8 7.8 6 7.8-6"/>',
    'video': '<rect x="3.4" y="6.6" width="12.2" height="10.8" rx="1.8"/><path d="m15.6 10.6 5-3v8.8l-5-3"/>',
    'lakat': '<rect x="5" y="10.4" width="14" height="9.8" rx="1.6"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>'
  };
  /* Arckép-helyőrző: szürke, kézzel rajzolt mellkép. Szándékosan színtelen, hogy ne tűnjön valódi embernek. */
  var portre = '<symbol id="i-portre" viewBox="0 0 48 48">' +
    '<defs><clipPath id="portre-kor"><circle cx="24" cy="24" r="24"/></clipPath></defs>' +
    '<g clip-path="url(#portre-kor)">' +
      '<rect width="48" height="48" fill="#D3D6DA"/>' +
      '<path d="M5.5 49c1.2-8.8 8-13.6 18.5-13.6S41.3 40.2 42.5 49z" fill="#575C66"/>' +
      '<path d="M19.3 36.1 24 43.2l4.7-7.1c-1.5-.5-3-.7-4.7-.7s-3.2.2-4.7.7z" fill="#F3F4F5"/>' +
      '<path d="M20.6 28.4h6.8v7.2c-1.1.7-2.2 1-3.4 1s-2.3-.3-3.4-1z" fill="#BFC3C9"/>' +
      '<ellipse cx="16.3" cy="21.6" rx="1.5" ry="2.3" fill="#DADDE0"/>' +
      '<ellipse cx="31.7" cy="21.6" rx="1.5" ry="2.3" fill="#DADDE0"/>' +
      '<path d="M24 11.4c4.5 0 7.6 3.4 7.6 9.2 0 5.9-3.4 10.3-7.6 10.3s-7.6-4.4-7.6-10.3c0-5.8 3.1-9.2 7.6-9.2z" fill="#E9EBED"/>' +
      '<path d="M16.1 20.2c-.7-6.3 2.8-10.6 8.1-10.6 5.5 0 8.6 3.9 7.8 10.3-.8-2.6-2.3-4.4-4.6-5.2-2.8 1.9-6.6 3.1-11.3 5.5z" fill="#6B7079"/>' +
    '</g></symbol>';
  var s = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">';
  for (var k in I) s += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + I[k] + '</symbol>';
  s += portre + '</svg>';
  document.body.insertAdjacentHTML('afterbegin', s);

  /* Másolás: a felirat az eredményt mondja („Kimásolva” pipával), 2 s múlva visszaáll. */
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-masol]');
    if (!g) return;
    try { navigator.clipboard && navigator.clipboard.writeText(g.getAttribute('data-masol')); } catch (x) {}
    var regi = g.innerHTML;
    g.classList.add('kimasolva');
    g.innerHTML = '<svg class="ikon"><use href="#i-pipa"/></svg>Kimásolva';
    setTimeout(function () { g.classList.remove('kimasolva'); g.innerHTML = regi; }, 2000);
  });
})();

/* Képernyőkép-segéd: a teljes magasság és a betűk betöltési állapota a gyökérelemre kerül. */
(function () {
  if (!document.fonts) return;
  document.fonts.ready.then(function () {
    var r = document.documentElement;
    r.setAttribute('data-h', Math.ceil(r.scrollHeight));
    var l = [];
    document.fonts.forEach(function (f) { l.push(f.family.replace(/"/g, '').split(' ')[0] + f.weight + ':' + f.status); });
    r.setAttribute('data-betu', l.join(','));
  });
})();
