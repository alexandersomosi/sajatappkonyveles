// Kézjegy – kézzel rajzolt SVG-ikonok egy közös készletben (24×24-es rács, 1,7-es vonal).
// Emoji, márkalogó és képgenerált kép nincs. A <use href="#…"> hivatkozik rájuk.
(function () {
  var K = window.KEZJEGY || { alairas: '', monogram: '' };
  var s = '' +
  '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
  // aláírás és monogram (helyőrző; élesben a könyvelő saját, egyszer leadott tollvonása)
  '<symbol id="alairas" viewBox="0 0 210 78"><path d="' + K.alairas + '"/></symbol>' +
  '<symbol id="monogram" viewBox="0 0 46 30"><path d="' + K.monogram + '"/></symbol>' +
  // Bence arcképe: HELYŐRZŐ rajz a fénykép helyén (élesben a könyvelő valódi fotója)
    '<defs>' +
    '<linearGradient id="bArc" x1="0" y1="0" x2="1" y2="0.25"><stop offset="0" stop-color="#F0C9AC"/><stop offset=".6" stop-color="#E4B293"/><stop offset="1" stop-color="#C99476"/></linearGradient>' +
    '<linearGradient id="bHaj" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A3528"/><stop offset="1" stop-color="#2A1E17"/></linearGradient>' +
    '<radialGradient id="bHatter" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#E3E8F0"/><stop offset="1" stop-color="#BCC7D8"/></radialGradient>' +
    '<linearGradient id="bZako" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A4766"/><stop offset="1" stop-color="#26304A"/></linearGradient>' +
    '</defs><symbol id="bence" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" fill="url(#bHatter)"/><g transform="translate(-7 -7.4) scale(1.22)">' +
    '<g transform="translate(0 -2.6)"><path d="M-2 68V59C1 51.6 8.6 48 16.6 46.6L25 45l7 7.6L39 45l8.4 1.6C55.4 48 63 51.6 66 59v7z" fill="url(#bZako)"/>' +
    '<path d="M26.2 36.4h11.6v9.4c-1.7 2-3.7 3-5.8 3s-4.1-1-5.8-3z" fill="#CC9475"/>' +
    '<path d="M26.2 38.6c1.8 1.6 3.7 2.4 5.8 2.4s4-.8 5.8-2.4v-2.2H26.2z" fill="#B47C5F" opacity=".7"/>' +
    '<path d="M25 45l7 7.6 7-7.6-1.8-1.4L32 48.4l-5.2-4.8z" fill="#EEF2F7"/>' +
    '<path d="M25 45l4.6 11.4M39 45l-4.6 11.4" stroke="#4A5878" stroke-width="1" fill="none"/></g>' +
    '<ellipse cx="21.3" cy="27.6" rx="2" ry="3.3" fill="#D6A083"/><ellipse cx="42.7" cy="27.6" rx="2" ry="3.3" fill="#C38D70"/>' +
    '<path d="M21.6 25C21.6 16.6 26 12.6 32 12.6S42.4 16.6 42.4 25c0 6-1.4 10.4-3.9 13.2-1.9 2-4.1 2.9-6.5 2.9s-4.6-.9-6.5-2.9C23 35.4 21.6 31 21.6 25z" fill="url(#bArc)"/>' +
    '<path d="M21 25.2C19.9 15.6 24.9 10.6 32.3 10.6c7.4 0 12 4.6 11 14.2-.6-3.4-1.9-5.8-3.7-7.2-2.9 1.6-7.4 2.3-11.6 1.7l1.6-1.9c-2.6.7-4.6 1.4-6.1 2.6-1.3 1.3-2.1 3-2.5 5.2z" fill="url(#bHaj)"/>' +
    '<path d="M25.6 24.2c1.3-.6 2.8-.7 4.2-.3M34.2 23.9c1.4-.4 2.9-.3 4.2.3" fill="none" stroke="#3A2A20" stroke-width="1.05" stroke-linecap="round" opacity=".9"/>' +
    '<ellipse cx="27.7" cy="27.3" rx="1.15" ry=".8" fill="#2E2520"/><ellipse cx="36.3" cy="27.3" rx="1.15" ry=".8" fill="#2E2520"/>' +
    '<path d="M33 29.4c.3 1.3.7 2.2 1.2 2.8-.7.5-1.6.6-2.4.4" fill="none" stroke="#B07A5E" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>' +
    '<path d="M29.6 36.2c1.5.5 3.3.5 4.8 0" fill="none" stroke="#9A5C4C" stroke-width=".8" stroke-linecap="round" opacity=".75"/></g>' +
    '</symbol>' +
  // fülek
  '<symbol id="haz" viewBox="0 0 24 24"><path d="M4 10.6 12 4.2l8 6.4"/><path d="M5.8 9.4V19.6h4.4v-5.2h3.6v5.2h4.4V9.4"/></symbol>' +
  '<symbol id="dosszie" viewBox="0 0 24 24"><path d="M3.4 6.6c0-.8.6-1.4 1.4-1.4h4.3l1.9 2.1h8.2c.8 0 1.4.6 1.4 1.4v9.6c0 .8-.6 1.4-1.4 1.4H4.8c-.8 0-1.4-.6-1.4-1.4z"/><path d="M3.4 10h17.2"/></symbol>' +
  '<symbol id="uzenet" viewBox="0 0 24 24"><path d="M4.2 6.2c0-1 .8-1.8 1.8-1.8h12c1 0 1.8.8 1.8 1.8v8.6c0 1-.8 1.8-1.8 1.8h-7.2l-4.2 3.4v-3.4h-.6c-1 0-1.8-.8-1.8-1.8z"/><path d="M8 9.2h8M8 12.2h5"/></symbol>' +
  '<symbol id="fiok" viewBox="0 0 24 24"><circle cx="12" cy="8.4" r="3.7"/><path d="M4.6 19.8c.9-3.7 3.9-5.6 7.4-5.6s6.5 1.9 7.4 5.6"/></symbol>' +
  // nyilak
  '<symbol id="jobbra" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></symbol>' +
  '<symbol id="balra" viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></symbol>' +
  // ujjlenyomat (öt ív, kézzel igazítva) – az első belépés utáni egyszeri kérdéshez
  '<symbol id="ujj" viewBox="0 0 24 24"><path d="M5.6 8.2a7.6 7.6 0 0 1 13.4.6"/><path d="M4.4 12.4c.1-.8.3-1.6.6-2.3"/><path d="M19.6 11.2c.2 1.4.2 2.8 0 4.2"/><path d="M7.4 18.6c-.8-1.6-1.2-3.4-1.1-5.3a5.7 5.7 0 0 1 11.4-.2c.1 2.4-.2 4.6-1 6.6"/><path d="M9.2 13.4a2.8 2.8 0 0 1 5.6 0c.1 2.8-.4 5.2-1.6 7.2"/><path d="M12 13.6c.1 2.4-.4 4.6-1.6 6.6"/><path d="M8.9 16.6c-.2 1.2-.6 2.3-1.2 3.3"/></symbol>' +
  // dosszié-tételek
  '<symbol id="foto" viewBox="0 0 24 24"><path d="M3.8 8.2c0-.8.6-1.4 1.4-1.4h2.6l1.5-2h5.4l1.5 2h2.6c.8 0 1.4.6 1.4 1.4v9.6c0 .8-.6 1.4-1.4 1.4H5.2c-.8 0-1.4-.6-1.4-1.4z"/><circle cx="12" cy="12.8" r="3.4"/></symbol>' +
  '<symbol id="szamla" viewBox="0 0 24 24"><path d="M6 3.6h8.4L18 7.2v13.2H6z"/><path d="M14.2 3.8v3.6H18"/><path d="M8.8 11.2h6.4M8.8 14.2h6.4M8.8 17.2h3.6"/></symbol>' +
  '<symbol id="boritek" viewBox="0 0 24 24"><path d="M3.6 6.6h16.8v11.2H3.6z"/><path d="M3.8 6.9 12 13l8.2-6.1"/></symbol>' +
  '<symbol id="bevallas" viewBox="0 0 24 24"><path d="M6 3.6h8.4L18 7.2v13.2H6z"/><path d="M14.2 3.8v3.6H18"/><path d="M8.8 14.2l2.2 2.2 4.2-4.6"/></symbol>' +
  '<symbol id="kivonat" viewBox="0 0 24 24"><path d="M5.4 4.2h13.2v16.2l-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4z"/><path d="M8.4 8.6h7.2M8.4 11.6h7.2M8.4 14.6h4"/></symbol>' +
  // műveletek
  '<symbol id="kapocs" viewBox="0 0 24 24"><path d="M15.8 7.6 9.2 14.2a1.9 1.9 0 0 0 2.7 2.7l7-7a3.6 3.6 0 0 0-5.1-5.1l-7.2 7.2a5.3 5.3 0 0 0 7.5 7.5l5.6-5.6"/></symbol>' +
  '<symbol id="feltolt" viewBox="0 0 24 24"><path d="M12 15.4V4.6"/><path d="M7.6 8.8 12 4.4l4.4 4.4"/><path d="M4.6 14.2v3.8c0 1 .8 1.8 1.8 1.8h11.2c1 0 1.8-.8 1.8-1.8v-3.8"/></symbol>' +
  '<symbol id="masol" viewBox="0 0 24 24"><rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2"/><path d="M15.4 8.2V6.2c0-1.1-.9-2-2-2H6.2c-1.1 0-2 .9-2 2v7.2c0 1.1.9 2 2 2h2"/></symbol>' +
  '<symbol id="naptar" viewBox="0 0 24 24"><rect x="4" y="5.6" width="16" height="14.2" rx="2"/><path d="M4 10.2h16M8.4 3.6v3.8M15.6 3.6v3.8"/><path d="M8.6 14.4h2.2"/></symbol>' +
  '<symbol id="igazolas" viewBox="0 0 24 24"><path d="M6 3.6h8.4L18 7.2v13.2H6z"/><path d="M14.2 3.8v3.6H18"/><path d="M8.8 10.6h6.4"/><circle cx="12" cy="15.6" r="2.4"/></symbol>' +
  '<symbol id="ceruza" viewBox="0 0 24 24"><path d="M15.2 5.2l3.6 3.6L9 18.6l-4.6 1 1-4.6z"/><path d="M13.2 7.2l3.6 3.6"/></symbol>' +
  '<symbol id="valasz" viewBox="0 0 24 24"><path d="M9.6 6.4 4.6 11l5 4.6"/><path d="M5 11h9.2c3.2 0 5.4 2.2 5.4 5.4v1.2"/></symbol>' +
  '<symbol id="video" viewBox="0 0 24 24"><path d="M3.6 7.4c0-.8.6-1.4 1.4-1.4h9.4c.8 0 1.4.6 1.4 1.4v9.2c0 .8-.6 1.4-1.4 1.4H5c-.8 0-1.4-.6-1.4-1.4z"/><path d="M15.8 10.4l4.6-2.8v8.8l-4.6-2.8"/></symbol>' +
  '<symbol id="pipa" viewBox="0 0 24 24"><path d="M6.4 12.6l3.6 3.6 7.6-8.2"/></symbol>' +
  '<symbol id="lakat" viewBox="0 0 24 24"><path d="M6.2 10.6h11.6v9.2H6.2z"/><path d="M8.6 10.6V8a3.4 3.4 0 0 1 6.8 0v2.6"/></symbol>' +
  // állapotjelek (16×16): kész = teli kör pipával, várakozik = óra
  '<symbol id="kesz-jel" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.6" fill="currentColor"/><path d="M4.7 8.3l2.2 2.2 4.4-4.7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
  '<symbol id="var-jel" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.4V8l2.5 1.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
  // állapotsor (rendszer)
  '<symbol id="terero" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx=".7"/><rect x="5" y="5.6" width="3" height="6.4" rx=".7"/><rect x="10" y="3" width="3" height="9" rx=".7"/><rect x="15" y="0" width="3" height="12" rx=".7"/></symbol>' +
  '<symbol id="akku" viewBox="0 0 27 13"><rect x=".6" y=".6" width="22.6" height="11.8" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".45"/><rect x="2.4" y="2.4" width="17" height="8.2" rx="1.8"/><path d="M24.6 4.4v4.2c.9-.3 1.5-1.1 1.5-2.1s-.6-1.8-1.5-2.1z" opacity=".5"/></symbol>' +
  '</svg>';
  document.currentScript.insertAdjacentHTML('afterend', s);
})();
