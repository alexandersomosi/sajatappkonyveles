// SPEC §28.K.10 (C változat + elválasztó, tulaj 11-19 20:10 / 20:20): a képernyő tartalmában a lapok és a szakaszcímek
// teljes szélességű fehér szakaszok, köztük egy 10 pt-os világoskék sáv (#D3DAFC, C_VEGLEGES). Árnyék, egymásra rakott lap, sötétítés nincs.
// Ezt a környezetet a Kepernyo adja; az alsó lapon (sheet) belül kikapcsol, ott a lap marad lekerekített kártya.
import { createContext, useContext } from 'react';

export const TeljesCtx = createContext(false);
export const useTeljes = () => useContext(TeljesCtx);

/** A szakaszok közti sáv vastagsága és színe – a tulaj végleges döntése (11-19 20:40, dizajn/C4_atlathato/C_VEGLEGES/kozos.css:
 *  `.szak + .szak { border-top: 10px solid #D3DAFC }`). Előtte: 8 px #EEF1F8 (C_elvalaszto). */
export const SAV = { vastag: 10, szin: '#D3DAFC' } as const;
