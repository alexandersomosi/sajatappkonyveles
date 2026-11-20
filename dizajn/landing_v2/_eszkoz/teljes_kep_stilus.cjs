// Csak a TELJES OLDALAS képekhez (kep.cjs, tulaj_kep.cjs), az oldalba nem kerül bele.
// A „Mit kapsz” ragadós bemutatója élőben görgetésre vált; egy álló, teljes oldalas képen a görgetési hossz üres sötét sáv lenne,
// a ragadós elemek pedig a nagyra állított nézet miatt rossz helyre kerülnének. Ezért a képhez:
//  - telefonon: a színpad egy képernyőnyi (az első lépés: telefon + haladásjelző + szöveg), a láthatatlan görgetési hossz 0;
//  - gépen: a lépések szövege egymás alatt (az első kiemelve), mellettük fent a telefon az első lépéssel.
// vh: a valódi képernyőmagasság (pl. 844 vagy 900), hogy a méretek ne a kép teljes magasságához igazodjanak.
module.exports = function teljesKepStilus(vh) {
  return `
@media (max-width: 980px) {
  .szinpad-mod .blepes { height: 0 !important; }
  .szinpad-mod .szinpad { position: relative !important; top: 0 !important; height: ${vh}px !important; height: calc(${vh}px - var(--fej)) !important; }
  .szinpad-mod { --szw: min(270px, calc((${vh}px - var(--fej) - 300px) / 2.046)) !important; }
}
@media (min-width: 981px) {
  .szinpad-mod { --szw: min(330px, calc((${vh}px - var(--fej) - 110px) / 2.046)) !important; }
  .szinpad-mod .blepesek { padding-bottom: 0 !important; }
  .szinpad-mod .blepes { min-height: 0 !important; padding: 28px 0 !important; }
  .szinpad-mod .szinpad { position: relative !important; top: 0 !important; margin-top: 28px; }
}`;
};
