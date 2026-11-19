// SimplePay kártyaregisztráció + első hónap (SPEC §9.2): a fizetés a böngészőben, az áruházakon kívül történik
// (valós, emberi szolgáltatás). Natívan auth-munkamenetként nyitjuk, a visszatérés: kezjegy://elofizetes/eredmeny.
// A pénz állapotát SOHA nem az app dönti el: csak a szerver IPN-je; az eredmény-képernyő a szerver szerinti állapotot mutatja.
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import type { FeePayStart, SubscriptionStartResult } from '../_shared/api';
import { post } from '../api/http';
import { SEMA } from '../config';

/** purpose 'card_update': a card change of a running subscription (pays the NEXT month, see SubscriptionView.nextPaidPeriodStart). */
export async function kartyasFizetes(purpose: 'subscribe' | 'card_update' = 'subscribe'): Promise<void> {
  const r = await post<SubscriptionStartResult>('/client/subscription/start', { platform: Platform.OS === 'web' ? 'web' : 'app', acceptedDeclarations: true, purpose });
  if (r.paymentUrl.startsWith('minta:')) {
    // MINTA mód: nincs valódi fizetőoldal
    router.push({ pathname: '/elofizetes/eredmeny', params: { e: 'SUCCESS', t: 'MINTA-501234567', o: r.orderRef } });
    return;
  }
  if (!/^https:\/\//.test(r.paymentUrl)) throw new Error('Érvénytelen fizetési cím érkezett. Próbáld újra később.');
  if (Platform.OS === 'web') {
    window.location.assign(r.paymentUrl);
    return;
  }
  const vissza = `${SEMA}://elofizetes`;
  const eredmeny = await WebBrowser.openAuthSessionAsync(r.paymentUrl, vissza);
  if (eredmeny.type === 'success' && eredmeny.url) {
    const { queryParams } = Linking.parse(eredmeny.url);
    const e = String(queryParams?.e ?? '');
    const t = String(queryParams?.t ?? '');
    router.push({ pathname: '/elofizetes/eredmeny', params: { e, t, o: r.orderRef } });
  } else {
    router.push({ pathname: '/elofizetes/eredmeny', params: { e: 'CANCEL', o: r.orderRef } });
  }
}

/**
 * SPEC §28.K.1: egyszeri díj (változás bejelentése helyetted, éves zárás) – egyszeri SimplePay fizetés, soha nem a havidíj
 * tárolt kártyája. A díj állapotát itt sem az app dönti el: utána a Díjak képernyő a szerver szerinti állapotot mutatja.
 */
export async function dijFizetes(id: string): Promise<void> {
  const r = await post<FeePayStart>(`/client/fees/${encodeURIComponent(id)}/pay`, { platform: Platform.OS === 'web' ? 'web' : Platform.OS });
  if (r.paymentUrl.startsWith('/')) {
    // MINTA: nincs valódi fizetőoldal
    router.replace(r.paymentUrl as never);
    return;
  }
  if (!/^https:\/\//.test(r.paymentUrl)) throw new Error('Érvénytelen fizetési cím érkezett. Próbáld újra később.');
  if (Platform.OS === 'web') {
    window.location.assign(r.paymentUrl);
    return;
  }
  await WebBrowser.openAuthSessionAsync(r.paymentUrl, `${SEMA}://fiok/dijak`);
  router.replace({ pathname: '/fiok/dijak', params: { o: r.orderRef } });
}
