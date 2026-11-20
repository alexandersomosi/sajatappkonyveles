// SPEC §29.10 – /bevezeto: the guided first run's router. It asks the server (GET /client/guided, always fresh) where the
// client is, and opens that screen: the welcome screens, the branch question, the next step (the existing step screens
// with `?vezetett=<lépés>`), the waiting screen once after a hand-over, or the done screen. `?vissza=<lépés>` opens the
// previous guided step, `?lepes=<lépés>` a given one (the paused card and the journey notifications use it).
import { useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useGuided, useGuidedAction } from '@/api/hooks-k29g';
import { bevezetoCel } from '@/lib/bevezeto';
import { Betolt, Hiba, Kepernyo } from '@/ui/keret';

export default function Bevezeto() {
  const p = useLocalSearchParams<{ utan?: string; vissza?: string; lepes?: string }>();
  const g = useGuided();
  const a = useGuidedAction();
  const ment = useRef(false);
  useEffect(() => {
    if (!g.data || g.isFetching || ment.current) return;
    ment.current = true;
    const cel = bevezetoCel(g.data, { utan: p.utan ?? null, vissza: p.vissza ?? null, lepes: p.lepes ?? null });
    // remember where the client is (for "Folytasd ott, ahol abbahagytad"); never blocks the move
    const kulcs = /[?&]vezetett=([^&]+)/.exec(cel)?.[1] ?? (cel.startsWith('/bevezeto/ut') ? 'ut' : cel.startsWith('/bevezeto/adoszam') ? 'adoszam' : null);
    if (kulcs && kulcs !== g.data.lastKey) a.mutate({ action: 'step_seen', key: decodeURIComponent(kulcs) as never });
    router.replace(cel as never);
  }, [g.data, g.isFetching, p.utan, p.vissza, p.lepes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (g.error) return <Kepernyo><Hiba hiba={g.error} ujra={() => void g.refetch()} /></Kepernyo>;
  return <Kepernyo><Betolt szoveg="Egy pillanat…" /></Kepernyo>;
}
