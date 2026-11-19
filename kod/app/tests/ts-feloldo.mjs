// A tesztekhez: a kiterjesztés nélküli relatív importokat („../_shared/enums”) .ts fájlra oldja fel (Node típuseltávolítás).
import { register } from 'node:module';

register('./ts-hook.mjs', import.meta.url);
