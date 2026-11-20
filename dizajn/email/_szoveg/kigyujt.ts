// A levél- és értesítésszövegek kigyűjtése a Gemini-átnézéshez (11-20). Csak olvas.
import { DEFAULT_TEXTS } from '../../../kod/backend/src/content.ts';
import { writeFileSync } from 'node:fs';
const ki: Record<string, string> = {};
for (const [k, v] of Object.entries(DEFAULT_TEXTS)) if (k.startsWith('email.') || k.startsWith('notif.')) ki[k] = v;
writeFileSync(new URL('./szovegek.json', import.meta.url), JSON.stringify(ki, null, 1));
console.log(Object.keys(ki).length, 'szöveg');
