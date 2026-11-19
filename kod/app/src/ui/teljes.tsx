// SPEC §28.K.10 (C változat + elválasztó, tulaj 11-19 20:10 / 20:20): a képernyő tartalmában a lapok és a szakaszcímek
// teljes szélességű fehér szakaszok, köztük egy 8 pt-os halvány sáv (#EEF1F8). Árnyék, egymásra rakott lap, sötétítés nincs.
// Ezt a környezetet a Kepernyo adja; az alsó lapon (sheet) belül kikapcsol, ott a lap marad lekerekített kártya.
import { createContext, useContext } from 'react';

export const TeljesCtx = createContext(false);
export const useTeljes = () => useContext(TeljesCtx);

/** A szakaszok közti sáv vastagsága és színe (C_elvalaszto/kozos.css: `.szak + .szak { border-top: 8px solid #EEF1F8 }`). */
export const SAV = { vastag: 8, szin: '#EEF1F8' } as const;
