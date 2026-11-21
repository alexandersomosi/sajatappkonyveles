// k8 (FELÜLET-P, P7): the v2 menu stays accessible – the active item is aria-current="page", every Fluent icon is
// decoration (aria-hidden, never focusable), the badge carries its meaning for screen readers too, and every menu icon
// of every role exists in the shared v2 set (kod/shared/v2).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Csoport } from './Shell';
import { menuCsoportok, type MenuCsoport } from '../lib/csapat';
import { EMOJI_ADAT } from '../_shared/v2/ikon/emoji-adat';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let hely: HTMLDivElement;
let root: Root;
beforeEach(() => {
  hely = document.createElement('div');
  document.body.appendChild(hely);
  root = createRoot(hely);
});
afterEach(() => {
  act(() => root.unmount());
  hely.remove();
});

const munka: MenuCsoport = menuCsoportok({ csapat: false, konyvelo: true, admin: false, demo: false, konyvelonekVoltVisszahivasa: false })[0]!;

describe('v2 menu (Shell)', () => {
  it('the active item has aria-current="page" and the v2 "on" look, the others not', () => {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/keresek']}>
          <Csoport cs={munka} db={{ keresek: { n: 3 } }} />
        </MemoryRouter>,
      ),
    );
    const linkek = [...hely.querySelectorAll('a')];
    const aktiv = linkek.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(aktiv.map((a) => a.textContent)).toEqual(['Kérések3 vár']);
    expect(aktiv[0]!.classList.contains('on')).toBe(true);
    expect(linkek.filter((a) => a.classList.contains('on'))).toHaveLength(1);
  });

  it('every icon is decoration (aria-hidden, not focusable); the group is labelled by its title', () => {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/ugyfelek']}>
          <Csoport cs={munka} db={{}} />
        </MemoryRouter>,
      ),
    );
    const ikonok = [...hely.querySelectorAll('svg')];
    expect(ikonok.length).toBe(munka.elemek.length);
    for (const s of ikonok) {
      expect(s.getAttribute('aria-hidden')).toBe('true');
      expect(s.getAttribute('focusable')).toBe('false');
      expect(s.getAttribute('role')).toBeNull();
    }
    const csoport = hely.querySelector('[role="group"]')!;
    const cim = document.getElementById(csoport.getAttribute('aria-labelledby')!);
    expect(cim?.textContent).toBe('Munka');
  });

  it('every menu icon of every role exists in the shared Fluent set', () => {
    const minden = [
      { csapat: true, konyvelo: false, admin: false },
      { csapat: false, konyvelo: true, admin: false },
      { csapat: false, konyvelo: false, admin: true },
      { csapat: false, konyvelo: true, admin: true },
    ].flatMap((o) => menuCsoportok({ ...o, demo: true, konyvelonekVoltVisszahivasa: true, konyvelonekVoltHelyettunk: true }).flatMap((g) => g.elemek));
    expect(minden.length).toBeGreaterThan(20);
    for (const e of minden) expect(EMOJI_ADAT[e.ikon], `${e.kulcs}: ${e.ikon}`).toBeTruthy();
  });
});
