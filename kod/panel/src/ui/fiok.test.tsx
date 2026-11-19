// Regression: a drawer whose form state lives in the parent (inline bezar={() => ...}) must keep the focus
// in the input while typing. Before the fix every keystroke re-ran the effect and focused the drawer div.
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Fiok } from './kozos';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Szulo() {
  const [nyitva, setNyitva] = useState(false);
  const [nev, setNev] = useState('');
  return (
    <div>
      <button type="button" id="nyito" onClick={() => setNyitva(true)}>
        Meghívás
      </button>
      <Fiok nyitva={nyitva} bezar={() => setNyitva(false)} cim="Könyvelő meghívása">
        <input id="nev" value={nev} onChange={(e) => setNev(e.target.value)} />
        <output id="kimenet">{nev}</output>
      </Fiok>
    </div>
  );
}

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
function gepel(input: HTMLInputElement, szoveg: string) {
  for (const ch of szoveg) {
    // Mimic a user: the key goes to whatever element has focus.
    const cel = document.activeElement as HTMLInputElement;
    if (cel !== input) return;
    act(() => {
      setValue.call(cel, cel.value + ch);
      cel.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
}

let hely: HTMLDivElement;
let root: Root;
beforeEach(() => {
  hely = document.createElement('div');
  document.body.appendChild(hely);
  root = createRoot(hely);
  act(() => root.render(<Szulo />));
});
afterEach(() => {
  act(() => root.unmount());
  hely.remove();
});

describe('Fiok (fiók-lap)', () => {
  it('gépelés közben a fókusz a mezőben marad', () => {
    const nyito = document.getElementById('nyito') as HTMLButtonElement;
    nyito.focus();
    act(() => nyito.click());
    const lap = document.querySelector('.fiok-lap') as HTMLElement;
    expect(document.activeElement).toBe(lap);
    const input = document.getElementById('nev') as HTMLInputElement;
    input.focus();
    gepel(input, 'anna.toth@demo.kezjegy.test');
    expect(input.value).toBe('anna.toth@demo.kezjegy.test');
    expect(document.activeElement).toBe(input);
    expect(document.getElementById('kimenet')!.textContent).toBe('anna.toth@demo.kezjegy.test');
  });

  it('bezáráskor visszaadja a fókuszt a nyitó gombnak, Esc is bezár', () => {
    const nyito = document.getElementById('nyito') as HTMLButtonElement;
    nyito.focus();
    act(() => nyito.click());
    // nothing typed: Escape closes at once
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.querySelector('.fiok-lap')).toBeNull();
    expect(document.activeElement).toBe(nyito);
  });

  it('beírt szöveggel a bezárás előbb rákérdez (Esc, kattintás a háttérre, Bezár), és csak megerősítésre zár', () => {
    const nyito = document.getElementById('nyito') as HTMLButtonElement;
    nyito.focus();
    act(() => nyito.click());
    const input = document.getElementById('nev') as HTMLInputElement;
    input.focus();
    gepel(input, 'Tóth Anna');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    // still open, the question is shown, the typed text is intact
    expect(document.querySelector('.fiok-lap')).not.toBeNull();
    expect(document.querySelector('.fiok-kerdes')?.textContent).toContain('még nincs elmentve');
    expect((document.getElementById('nev') as HTMLInputElement).value).toBe('Tóth Anna');
    // "Folytatom" hides the question and keeps the drawer
    const gombok = () => [...document.querySelectorAll<HTMLButtonElement>('.fiok-kerdes button')];
    act(() => gombok().find((b) => b.textContent === 'Folytatom')!.click());
    expect(document.querySelector('.fiok-kerdes')).toBeNull();
    expect(document.querySelector('.fiok-lap')).not.toBeNull();
    // a click on the backdrop asks again; "Elvetem" closes and gives the focus back
    act(() => (document.querySelector('.fuggony') as HTMLElement).click());
    expect(document.querySelector('.fiok-kerdes')).not.toBeNull();
    act(() => gombok().find((b) => b.textContent === 'Elvetem')!.click());
    expect(document.querySelector('.fiok-lap')).toBeNull();
    expect(document.activeElement).toBe(nyito);
  });
});
