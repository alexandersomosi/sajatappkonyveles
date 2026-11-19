/* NEM HASZNÁLT (2026-11-17, második kör): a szárazpecsétet kivettük, helyette lapos szilva pipa (#i-kor-pipa) és egy mondat áll. A fájl csak az első kör emlékeként maradt itt. */
/* Rendben: szárazpecsét. Színe nincs, csak fény és árnyék.
   Felül: a könyvelő neve, alul: a lezárt hónap vagy a beadás napja, középen pipa. Tagolójel nincs.
   Rajzolás: árnyékmásolat (jobbra le), fénymásolat (balra fel), fölöttük ugyanaz papírszínnel.
   Így csak a domborítás széle látszik, mint a valódi vaknyomásnál.
   Használat: <svg class="pecset" data-felso="Kovács Bence könyvelő" data-also="2026. október"></svg>
   A "benyom" osztály egyszer lejátssza a 0,4 s-os benyomódást (csökkentett mozgásnál nem). */
(function () {
  var n = 0;
  function rajz(id, fest, vastag) {
    return '' +
      '<circle cx="50" cy="50" r="44.6" fill="none" stroke="' + fest + '" stroke-width="' + (1.5 * vastag) + '"/>' +
      '<circle cx="50" cy="50" r="42.2" fill="none" stroke="' + fest + '" stroke-width="' + (.7 * vastag) + '"/>' +
      '<circle cx="50" cy="50" r="27.4" fill="none" stroke="' + fest + '" stroke-width="' + (1.1 * vastag) + '"/>' +
      '<path d="M38.6 50.8 46.2 58.3 61.6 41.4" fill="none" stroke="' + fest + '" stroke-width="' + (4.6 * vastag) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<g font-family="Schibsted Grotesk, sans-serif" font-weight="700" font-size="9" letter-spacing=".2" text-anchor="middle" fill="' + fest + '">' +
        '<text><textPath href="#' + id + 'f" startOffset="50%">' + this_felso + '</textPath></text>' +
        '<text><textPath href="#' + id + 'a" startOffset="50%">' + this_also + '</textPath></text>' +
      '</g>';
  }
  var this_felso = '', this_also = '';
  function pecset(svg) {
    var id = 'pe' + (++n);
    this_felso = svg.getAttribute('data-felso') || 'Kovács Bence könyvelő';
    this_also = svg.getAttribute('data-also') || '2026. október';
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Szárazpecsét: ' + this_felso + ', ' + this_also);
    var papir = 'url(#' + id + 'p)';
    var h = '' +
      '<defs>' +
        '<path id="' + id + 'f" d="M21.4 63.3 A31.6 31.6 0 1 1 78.6 63.3"/>' +
        '<path id="' + id + 'a" d="M13.8 66.9 A39.9 39.9 0 0 0 86.2 66.9"/>' +
        '<linearGradient id="' + id + 'p" gradientUnits="userSpaceOnUse" x1="22" y1="18" x2="84" y2="90">' +
          '<stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F1E9EF"/></linearGradient>' +
        '<filter id="' + id + 'l" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".22"/></filter>' +
        '<filter id="' + id + 'm" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".7"/></filter>' +
      '</defs>' +
      /* a benyomott papírkorong pereme */
      '<g class="p-arnyek"><circle cx="50.7" cy="50.8" r="48" fill="none" stroke="rgba(75,31,69,.20)" stroke-width="1.4" filter="url(#' + id + 'm)"/></g>' +
      '<g class="p-feny"><circle cx="49.2" cy="49.1" r="48" fill="none" stroke="#FFFFFF" stroke-width="1.6" filter="url(#' + id + 'm)"/></g>' +
      '<circle cx="50" cy="50" r="48" fill="' + papir + '"/>' +
      /* a domborított rajz: árnyék, fény, papír */
      '<g class="p-arnyek" transform="translate(.72 .78)" filter="url(#' + id + 'l)">' + rajz(id, 'rgba(75,31,69,.42)', 1) + '</g>' +
      '<g class="p-feny" transform="translate(-.66 -.7)" filter="url(#' + id + 'l)">' + rajz(id, '#FFFFFF', 1) + '</g>' +
      '<g>' + rajz(id, papir, 1) + '</g>';
    svg.innerHTML = h;
  }
  var all = document.querySelectorAll('svg.pecset');
  for (var i = 0; i < all.length; i++) pecset(all[i]);
})();
