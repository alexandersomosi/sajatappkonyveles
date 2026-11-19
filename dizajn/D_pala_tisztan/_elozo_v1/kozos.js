/* Tisztán – közös elemek: kézzel rajzolt ikonkészlet, állapotsor, alsó sáv, „Másolás”.
   Minden ikon saját rajz (24×24, 1,8-as vonal), nincs ikoncsomag és nincs emoji. */
(function () {
  var jelek = {
    'haz': '<path d="M3.8 10.6 12 4l8.2 6.6v8.9a1.2 1.2 0 0 1-1.2 1.2h-4.4v-5.9H9.4v5.9H5a1.2 1.2 0 0 1-1.2-1.2z"/>',
    'dosszie': '<path d="M3.5 6.8a1.3 1.3 0 0 1 1.3-1.3h4.6l2.1 2.3h7.7a1.3 1.3 0 0 1 1.3 1.3v9.6a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3z"/><path d="M3.5 10.6h17"/>',
    'uzenet': '<path d="M6.8 4.5h10.4a2.3 2.3 0 0 1 2.3 2.3v7.4a2.3 2.3 0 0 1-2.3 2.3h-6l-4.7 3.7v-3.7a2.3 2.3 0 0 1-2-2.3V6.8a2.3 2.3 0 0 1 2.3-2.3z"/>',
    'fiok': '<circle cx="12" cy="8.6" r="3.7"/><path d="M4.8 20.2c.9-3.7 3.7-5.7 7.2-5.7s6.3 2 7.2 5.7"/>',
    'jobbra': '<path d="M9 5.5 15.5 12 9 18.5"/>',
    'balra': '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
    'pipa': '<path d="M5 12.6 9.6 17 19 7.4"/>',
    'ujj': '<path d="M6.3 6.3A8.2 8.2 0 0 1 20 10.2"/><path d="M4.2 13.6a8.6 8.6 0 0 1 .5-4.9"/><path d="M5.7 17.6c.7-1.3 1-2.8 1-4.4a5.3 5.3 0 0 1 10.6 0c0 2.6-.3 5-1 7"/><path d="M8.7 20.2c1-1.9 1.4-4.2 1.4-7a1.9 1.9 0 0 1 3.8 0c0 .7 0 1.4-.1 2.1"/><path d="M13.5 18.1c-.3 1-.7 1.9-1.2 2.7"/><path d="M20.1 13.4c0 1-.1 2-.3 3"/>',
    'kamera': '<rect x="3" y="7" width="18" height="13" rx="2.2"/><path d="M8.3 7 9.8 4.5h4.4L15.7 7"/><circle cx="12" cy="13.4" r="3.6"/>',
    'kapocs': '<path d="M17.5 11.2 11 17.7a4 4 0 0 1-5.7-5.7l7.4-7.4a2.7 2.7 0 0 1 3.8 3.8l-7.2 7.2a1.35 1.35 0 0 1-1.9-1.9l6.5-6.5"/>',
    'kuld': '<path d="M12 19.5v-14M6 11l6-6 6 6"/>',
    'video': '<rect x="3" y="6.5" width="12.5" height="11" rx="2.2"/><path d="M15.5 10.6 21 7.6v8.8l-5.5-3z"/>',
    'naptar': '<rect x="3.8" y="5.3" width="16.4" height="15" rx="2"/><path d="M3.8 9.8h16.4M8.3 3.3v4M15.7 3.3v4"/>',
    'ora': '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3 2"/>',
    'irat': '<path d="M7 3.5h6.8L18.5 8v11.3a1.2 1.2 0 0 1-1.2 1.2H7a1.2 1.2 0 0 1-1.2-1.2V4.7A1.2 1.2 0 0 1 7 3.5z"/><path d="M13.5 3.7v4.6h4.8M9 12.5h6M9 16h6"/>',
    'szamla': '<path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    'level': '<rect x="3.3" y="5.8" width="17.4" height="12.6" rx="1.6"/><path d="m4 7 8 6.2L20 7"/>',
    'foto': '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.6" r="1.7"/><path d="m4 17.5 5-4.6 3.5 3 3-2.6 4.5 4"/>',
    'szem': '<path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="3"/>',
    'feltolt': '<path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9M4.5 15v3.3a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7V15"/>',
    'letolt': '<path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M4.5 15v3.3a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7V15"/>',
    'nagyit': '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5M10.5 8v5M8 10.5h5"/>'
  };
  var defs = '';
  for (var k in jelek) defs += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + jelek[k] + '</symbol>';
  document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + defs + '</defs></svg>');

  // Állapotsor (telefon teteje)
  var as = document.querySelector('[data-allapotsor]');
  if (as) {
    as.outerHTML =
      '<div class="allapotsor" aria-hidden="true"><span>9:41</span><span class="jelek">' +
      '<svg viewBox="0 0 18 12" width="18"><rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="5" y="5.5" width="3" height="6.5" rx=".8"/><rect x="10" y="3" width="3" height="9" rx=".8"/><rect x="15" y="0" width="3" height="12" rx=".8"/></svg>' +
      '<svg viewBox="0 0 16 12" width="16"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.4A10.6 10.6 0 0 0 8 .3 10.6 10.6 0 0 0 .5 3.3l1.3 1.4A8.7 8.7 0 0 1 8 2.2z"/><path d="M8 5.9c1.4 0 2.6.5 3.6 1.4l1.3-1.4A7 7 0 0 0 8 4a7 7 0 0 0-4.9 1.9l1.3 1.4A5.2 5.2 0 0 1 8 5.9z"/><path d="M8 9.5c.5 0 1 .2 1.3.5L8 11.5 6.7 10c.3-.3.8-.5 1.3-.5z"/></svg>' +
      '<svg viewBox="0 0 27 12" width="27"><rect x=".6" y=".6" width="22.8" height="10.8" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".45"/><rect x="2.2" y="2.2" width="17.5" height="7.6" rx="1.8"/><path d="M25 4.2v3.6c.8-.3 1.3-1 1.3-1.8s-.5-1.5-1.3-1.8z" opacity=".45"/></svg>' +
      '</span></div>';
  }

  // Alsó sáv: sötét pala, az aktív fül fehér
  var ful = document.body.getAttribute('data-ful');
  if (ful) {
    var fulek = [['fooldal', 'haz', 'Főoldal'], ['dosszie', 'dosszie', 'Dosszié'], ['uzenetek', 'uzenet', 'Üzenetek'], ['fiok', 'fiok', 'Fiók']];
    var olv = document.body.getAttribute('data-olvasatlan');
    var h = '<nav class="fulsor" aria-label="Fő menü">';
    fulek.forEach(function (f) {
      var akt = f[0] === ful;
      h += '<a class="ful' + (akt ? ' aktiv' : '') + '"' + (akt ? ' aria-current="page"' : '') + '>' +
        '<svg class="ikon"><use href="#i-' + f[1] + '"/></svg>' + f[2] +
        (olv === f[0] ? '<span class="pont" aria-label="olvasatlan üzenet"></span>' : '') + '</a>';
    });
    h += '</nav><div class="kezdojel" aria-hidden="true"></div>';
    document.body.insertAdjacentHTML('beforeend', h);
  } else if (document.body.classList.contains('telefon')) {
    document.body.insertAdjacentHTML('beforeend', '<div class="kezdojel" aria-hidden="true"></div>');
  }

  // „Másolás” → „Kimásolva”, ugyanabban a sorban
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-masol]');
    if (!b) return;
    try { navigator.clipboard.writeText(b.getAttribute('data-masol')); } catch (_) {}
    b.textContent = 'Kimásolva';
    setTimeout(function () { b.textContent = 'Másolás'; }, 2200);
  });
})();

/* Teljes hosszú kép a képernyőről (?teljes): a telefonkeret magassága helyett a teljes tartalom. */
(function () {
  if (location.search.indexOf('teljes') < 0) return;
  document.body.classList.remove('telefon');
  document.body.style.position = 'relative';
  document.body.style.minHeight = '844px';
  var jel = function () { document.documentElement.setAttribute('data-magassag', Math.ceil(document.body.scrollHeight)); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ setTimeout(jel, 50); }); else jel();
})();
