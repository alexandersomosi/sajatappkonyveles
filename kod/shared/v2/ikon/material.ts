// GENERÁLT – kézzel ne írd. Forrás: dizajn/C5_v2/v2.js (P, EGYEDI – Material Icons, Apache-2.0; saját chev).
// Újragenerálás: node kod/shared/v2/scripts/gen-ikonok.mjs
/* eslint-disable */
import type { IkonAdat, VezerloAdat } from './tipusok';

/** Egyszínű vezérlő-ikonok (24×24). A szín a hívótól jön (webes currentColor / RN `szin`). */
export const VEZERLO_NEVEK = ["pipa", "letolt", "csillag", "szem", "kuld", "plusz", "vissza", "bezar", "zaszlo", "kereses", "gemkapocs", "chev", "chev-le", "chev-fel", "chev-bal", "masol", "kulso", "frissit", "szuro", "tobb"] as const;
export type VezerloNev = (typeof VEZERLO_NEVEK)[number];

export const VEZERLO_VB = '0 0 24 24';

export const VEZERLO_ADAT: Readonly<Record<VezerloNev, VezerloAdat>> = {
  "pipa": { d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" }, // Material Icons (v2.js P)
  "letolt": { d: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" }, // Material Icons (v2.js P)
  "csillag": { d: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" }, // Material Icons (v2.js P)
  "szem": { d: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" }, // Material Icons (v2.js P)
  "kuld": { d: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" }, // Material Icons (v2.js P)
  "plusz": { d: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" }, // Material Icons (v2.js P)
  "vissza": { d: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" }, // Material Icons (v2.js P)
  "bezar": { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }, // Material Icons (v2.js P)
  "zaszlo": { d: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" }, // Material Icons (v2.js P)
  "kereses": { d: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" }, // Material Icons (v2.js P)
  "gemkapocs": { d: "M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" }, // Material Icons (v2.js P)
  "chev": { d: "M9 5.5l6.5 6.5L9 18.5", vonal: 2.4 }, // saját (v2.js EGYEDI)
  "chev-le": { d: "M5.5 9l6.5 6.5L18.5 9", vonal: 2.4 }, // saját, a chev elforgatva
  "chev-fel": { d: "M5.5 15l6.5-6.5L18.5 15", vonal: 2.4 }, // saját, a chev elforgatva
  "chev-bal": { d: "M15 5.5L8.5 12l6.5 6.5", vonal: 2.4 }, // saját, a chev elforgatva
  "masol": { d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" }, // Material Icons: content_copy
  "kulso": { d: "M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" }, // Material Icons: open_in_new
  "frissit": { d: "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" }, // Material Icons: refresh
  "szuro": { d: "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" }, // Material Icons: filter_list
  "tobb": { d: "M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" }, // Material Icons: more_horiz
};

/** A színes Google „G” (a Google-gombhoz; a márka színei nem változtathatók). */
export const GOOGLE_G: IkonAdat = { vb: '0 0 24 24', elemek: [
  { t: 'p', d: "M12 4.75c1.77 0 3.36.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l3.99 3.1C6.22 6.86 8.87 4.75 12 4.75z", f: "#EA4335" },
  { t: 'p', d: "M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.13 2.74-2.39 3.59l3.86 3c2.26-2.09 3.55-5.18 3.55-8.83z", f: "#4285F4" },
  { t: 'p', d: "M5.26 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29l-3.99-3.1C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.98-3.1z", f: "#FBBC05" },
  { t: 'p', d: "M12 24c3.24 0 5.97-1.07 7.95-2.9l-3.86-3c-1.08.72-2.46 1.15-4.09 1.15-3.13 0-5.78-2.11-6.73-4.96l-3.99 3.1C3.26 21.31 7.31 24 12 24z", f: "#34A853" },
] };
