// "Now" that re-renders the page every half minute (SLA countdowns, "Most hívom" timer).
import { useEffect, useState } from 'react';
import { mostMs } from '../lib/today';

export function useMost(lepesMs = 30_000): number {
  const [most, setMost] = useState(() => mostMs());
  useEffect(() => {
    const t = setInterval(() => setMost(mostMs()), lepesMs);
    return () => clearInterval(t);
  }, [lepesMs]);
  return most;
}
