// Adózz.hu v2: közös ikonkészlet + kitöltők. Minden képernyő <body> elején: <script src="v2.js"></script>
// Ikon: <svg class="i"><use href="#i-NEV"/></svg>  (szín = currentColor; csempében a .t-* osztály adja)
// Kitöltők: <div class="allapot"></div>, <span class="logo" data-meret="30" [data-hatter="feher"]></span>, <nav class="nav" data-aktiv="fooldal|dosszie|fotozas|uzenetek|fiok" [data-pont="uzenetek"]></nav>
// Az egyszínű ikonok a Material Icons (Apache 2.0) útvonalai; a főoldal 4 színes ikonja (tárca, irat, oszlopok, naptár) saját rajz.
(function () {
  var P = {
    'fooldal': 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    'dosszie': 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    'kamera': 'M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8.2a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z',
    'uzenet': 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
    'fiok': 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    'csengo': 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    'telefon': 'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z',
    'naptar': 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
    'irat': 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    'lakat': 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    'level': 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    'pipa-kor': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    'pipa': 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    'info': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    'figyelem': 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    'kerdes': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
    'pajzs': 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
    'kartya': 'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
    'nyugta': 'M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z',
    'feltolt': 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z',
    'letolt': 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    'ora': 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    'beallitas': 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    'kilep': 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
    'epulet': 'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z',
    'igazolvany': 'M20 7h-5V4c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM9 12c.83 0 1.5.67 1.5 1.5S9.83 15 9 15s-1.5-.67-1.5-1.5S8.17 12 9 12zm3 6H6v-.75c0-1 2-1.5 3-1.5s3 .5 3 1.5V18zm1-9h-2V4h2v5zm5 7.5h-4V15h4v1.5zm0-3h-4V12h4v1.5z',
    'toll': 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    'emberek': 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    'cimke': 'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z',
    'valtozas': 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    'csillag': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    'kuka': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    'szem': 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    'kuld': 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
    'plusz': 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    'vissza': 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    'bezar': 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    'bank': 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z',
    'jogi': 'M1 21h12v2H1zM5.245 8.07l2.83-2.827 14.14 14.142-2.828 2.828zM12.317 1l5.657 5.656-2.83 2.83-5.654-5.66zM3.825 9.485l5.657 5.657-2.828 2.828-5.657-5.657z',
    'zaszlo': 'M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z',
    'kep': 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
    'vaku': 'M7 2v11h3v9l7-12h-4l4-8z',
    'kulcs': 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    'mobil': 'M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z',
    'kereses': 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    'gemkapocs': 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
    'lejatszas': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
    'kerdoiv': 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    'emelkedes': 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
    'oszlop': 'M3.5 13h4.2v8H3.5zM9.9 8.5h4.2V21H9.9zM16.3 3.5h4.2V21h-4.2z'
  };
  var EGYEDI = {
    // a főoldal színes ikonjai (fooldal_v2), a jóváhagyott minta szerint
    'tarca': '<path d="M5 7.5l10.2-3.6c.9-.3 1.8.3 1.8 1.2V7.5" fill="none" stroke="#10152B" stroke-width="1.8" stroke-linejoin="round"/><rect x="3" y="7.5" width="18" height="13" rx="3" fill="#FFC93C" stroke="#10152B" stroke-width="1.8"/><rect x="14" y="11.5" width="7" height="5" rx="2" fill="#fff" stroke="#10152B" stroke-width="1.8"/><circle cx="16.8" cy="14" r="1" fill="#10152B"/>',
    'irat-toll': '<rect x="3.5" y="3" width="13" height="18" rx="2.5" fill="#1F3BE0"/><path d="M7 8h6M7 12h6M7 16h3.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M14.2 18.6l.5-2.6 5.4-5.4a1.3 1.3 0 0 1 1.9 0l.2.2a1.3 1.3 0 0 1 0 1.9l-5.4 5.4z" fill="#7C92FF" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>',
    'oszlopok': '<g fill="#1FA855"><rect x="3.5" y="13" width="4.2" height="8" rx="1.6"/><rect x="9.9" y="8.5" width="4.2" height="12.5" rx="1.6"/><rect x="16.3" y="3.5" width="4.2" height="17.5" rx="1.6"/></g>',
    'naptar-sz': '<rect x="3" y="4.5" width="18" height="16.5" rx="3" fill="#F97316"/><path d="M3 9.5h18" stroke="#C2410C" stroke-width="1.6"/><path d="M8 2.8v3.6M16 2.8v3.6" stroke="#9A3412" stroke-width="2" stroke-linecap="round"/><g fill="#fff"><rect x="6" y="12" width="3" height="2.6" rx=".8"/><rect x="10.5" y="12" width="3" height="2.6" rx=".8"/><rect x="15" y="12" width="3" height="2.6" rx=".8"/><rect x="6" y="16" width="3" height="2.6" rx=".8"/><rect x="10.5" y="16" width="3" height="2.6" rx=".8"/></g>',
    'buborek': '<path d="M5 3.5h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8.5L6 21.2c-.5.4-1.2 0-1.2-.6v-3.1A3 3 0 0 1 2 14.5v-8a3 3 0 0 1 3-3z" fill="#1F3BE0"/><circle cx="7.6" cy="10.5" r="1.5" fill="#fff"/><circle cx="12" cy="10.5" r="1.5" fill="#fff"/><circle cx="16.4" cy="10.5" r="1.5" fill="#fff"/>',
    'google': '<path fill="#EA4335" d="M12 4.75c1.77 0 3.36.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l3.99 3.1C6.22 6.86 8.87 4.75 12 4.75z"/><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.13 2.74-2.39 3.59l3.86 3c2.26-2.09 3.55-5.18 3.55-8.83z"/><path fill="#FBBC05" d="M5.26 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29l-3.99-3.1C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.98-3.1z"/><path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.95-2.9l-3.86-3c-1.08.72-2.46 1.15-4.09 1.15-3.13 0-5.78-2.11-6.73-4.96l-3.99 3.1C3.26 21.31 7.31 24 12 24z"/>',
    'chev': '<path d="M9 5.5l6.5 6.5L9 18.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    'szamologep': '<rect x="3.5" y="2" width="17" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="6.5" y="5" width="11" height="4" rx="1" fill="currentColor" opacity=".7"/><g fill="currentColor" opacity=".7"><rect x="6.5" y="11" width="3" height="2.6" rx=".8"/><rect x="10.5" y="11" width="3" height="2.6" rx=".8"/><rect x="14.5" y="11" width="3" height="6.6" rx=".8"/><rect x="6.5" y="15" width="3" height="2.6" rx=".8"/><rect x="10.5" y="15" width="3" height="2.6" rx=".8"/></g>'
  };
  var sym = '';
  for (var k in P) sym += '<symbol id="i-' + k + '" viewBox="0 0 24 24"><path d="' + P[k] + '"/></symbol>';
  for (var e in EGYEDI) sym += '<symbol id="i-' + e + '" viewBox="0 0 24 24">' + EGYEDI[e] + '</symbol>';
  var d = document.createElement('div');
  d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">' + sym + '</svg>';
  document.body.insertBefore(d.firstChild, document.body.firstChild);

  function kesz(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  kesz(function () {
    document.querySelectorAll('.allapot:empty').forEach(function (el) {
      el.innerHTML = '<span>9:41</span><span class="j">' +
        '<svg viewBox="0 0 18 12" width="18" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>' +
        '<svg viewBox="0 0 16 12" width="16"><path d="M1.5 4.6a9.5 9.5 0 0 1 13 0M4.1 7.4a5.8 5.8 0 0 1 7.8 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="8" cy="10.2" r="1.6" fill="currentColor"/></svg>' +
        '<svg viewBox="0 0 27 13" width="27"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".55"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" opacity=".55"/></svg></span>';
    });
    document.querySelectorAll('span.logo:empty').forEach(function (el) {
      var feher = el.getAttribute('data-hatter') === 'feher';
      var m = el.getAttribute('data-meret') || '30';
      var tobbi = el.className.replace(/\blogo\b/, '').trim();
      el.outerHTML = '<span class="wm8' + (feher ? ' feher' : '') + (tobbi ? ' ' + tobbi : '') + '" style="font-size:' + m + 'px">Adó<span class="zz">zz</span>.hu<svg viewBox="0 0 300 26" preserveAspectRatio="none"><path d="M6 18 C 90 6, 210 2, 294 10" fill="none" stroke="' + (feher ? '#F2B705' : '#FFC93C') + '" stroke-width="11" stroke-linecap="round"/></svg></span>';
    });
    document.querySelectorAll('nav.nav:empty').forEach(function (el) {
      var akt = el.getAttribute('data-aktiv') || 'fooldal', pont = el.getAttribute('data-pont') || '';
      var F = [['fooldal', 'fooldal', 'Főoldal'], ['dosszie', 'dosszie', 'Dosszié'], ['fotozas', 'kamera', 'Fotózás'], ['uzenetek', 'uzenet', 'Üzenetek'], ['fiok', 'fiok', 'Fiók']];
      el.setAttribute('aria-label', 'Fülek');
      el.innerHTML = F.map(function (f) {
        return '<button class="' + (f[0] === akt ? 'on' : '') + '"><svg><use href="#i-' + f[1] + '"/></svg>' + (pont.split(' ').indexOf(f[0]) >= 0 ? '<span class="pont"></span>' : '') + f[2] + '</button>';
      }).join('');
    });
  });
})();
