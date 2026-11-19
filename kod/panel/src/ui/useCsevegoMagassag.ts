// The chat list takes exactly the height that is left in the window, so the composer under it is always in view
// (targets: 1440×900 and 1280×720; before this the list was a fixed 560 px and the composer fell below the fold).
import { useLayoutEffect, type RefObject } from 'react';

export function useCsevegoMagassag(ref: RefObject<HTMLElement | null>, fuggosegek: unknown[] = []) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const szamol = () => {
      const e = el.getBoundingClientRect();
      const felul = e.top + window.scrollY;
      // whatever sits under the list inside the same sheet (composer, notice) + a 16 px gap under the sheet
      const lap = el.closest('.lap');
      const alul = 16 + (lap ? Math.max(0, lap.getBoundingClientRect().bottom - e.bottom) : 0);
      el.style.maxHeight = `${Math.max(200, Math.round(window.innerHeight - felul - alul))}px`;
    };
    szamol();
    window.addEventListener('resize', szamol);
    // the composer grows (longer text, attachment chips): keep the sum inside the window
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(szamol) : null;
    if (ro && el.nextElementSibling) ro.observe(el.nextElementSibling);
    return () => {
      window.removeEventListener('resize', szamol);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, fuggosegek);
}
