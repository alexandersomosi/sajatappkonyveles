// k8 ALAP-B – /bekotes/visszahivas-ajanlat: the guided step 'visszahivas_ajanlat' (GUIDED_OWN_ROUTES) before the payment.
// Minimal screen in the CURRENT style; FELÜLET-A brings it to v2 (35_bekotes_idopont). The old /bekotes/idopont stays.
import { CALLBACK_OFFER_TEXTS as X } from '@/_shared/k8';
import { useGuided } from '@/api/hooks-k29g';
import { bekotesre } from '@/lib/vezetett';
import { VisszahivasAjanlat } from '@/kepernyok/VisszahivasAjanlat';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';

export default function VisszahivasAjanlatKepernyo() {
  const g = useGuided();
  const lepes = g.data?.steps.find((s) => s.key === 'visszahivas_ajanlat');
  const fej = <CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim={X.stepTitle} />;
  return (
    <Kepernyo ful="fooldal" fejlec={fej}>
      {g.isLoading ? <Betolt /> : g.error ? <Hiba hiba={g.error} ujra={() => void g.refetch()} /> : <VisszahivasAjanlat nyitott={lepes?.state === 'var'} tovabb={() => bekotesre('/bekotes/elofizetes')} />}
    </Kepernyo>
  );
}
