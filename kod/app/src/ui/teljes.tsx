// k8 (v2): a Kepernyo tartalmában a lapok fehér kártyák a szürke háttéren (árnyékkal, gépen egér fölött megemelkednek);
// az alsó lapon (sheet) belül a környezet hamis: ott a kártya árnyék nélküli. (A régi C-dizájn teljes szélességű
// szakaszai és a 10 pt-os sáv megszűnt; a SAV csak a régi hívók miatt marad.)
import { createContext, useContext } from 'react';

export const TeljesCtx = createContext(false);
export const useTeljes = () => useContext(TeljesCtx);

/** A szakaszok közti sáv vastagsága és színe – a tulaj végleges döntése (11-19 20:40, dizajn/C4_atlathato/C_VEGLEGES/kozos.css:
 *  `.szak + .szak { border-top: 10px solid #D3DAFC }`). Előtte: 8 px #EEF1F8 (C_elvalaszto). */
export const SAV = { vastag: 10, szin: '#D3DAFC' } as const;
