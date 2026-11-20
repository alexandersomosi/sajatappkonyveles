// A belépési folyamat egyszerű lapjai (regisztráció, jelszó, kód): tintakék sáv címmel, alatta – SPEC §29.4.3, C_VEGLEGES –
// fehér alapon teljes szélességű szakaszok, köztük a 10 pt-os #D3DAFC sáv (a sáv alatti első szakasz előtt nincs sáv).
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { forma, szin } from '../theme/tokens';
import { Fejlec, Lap } from '../ui/alap';
import { MintaJel, vissza } from '../ui/keret';
import { TeljesCtx } from '../ui/teljes';
import { T } from '../ui/T';
import { Pressable } from 'react-native';

export function AuthKeret({ cim, al, children, visszaCim = 'Vissza a belépéshez', visszaHova = '/belepes', felso }: { cim: string; al?: string; children: ReactNode; visszaCim?: string | null; visszaHova?: string; felso?: ReactNode }) {
  let elsoVolt = false;
  let elsoLap = false;
  const elemek = Children.map(children, (c) => {
    if (!elsoVolt && isValidElement(c) && c.type === Lap) {
      elsoVolt = true;
      elsoLap = true;
      return cloneElement(c as ReactElement<{ elso?: boolean }>, { elso: true });
    }
    if (c !== null && c !== undefined && c !== false) elsoVolt = true;
    return c;
  });
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: szin.lap }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
        <Fejlec rozX={110} rozY={96} alsoTer={20}>
          {visszaCim ? (
            <Pressable accessibilityRole="link" onPress={() => vissza(visszaHova)} hitSlop={6} style={{ height: 36, justifyContent: 'center', paddingHorizontal: 20, alignSelf: 'flex-start' }}>
              <T m={16} s={500} c="#fff" alahuz>
                {visszaCim}
              </T>
            </Pressable>
          ) : null}
          {felso}
          <T m={29} s={700} lh={1.14} ls={-0.024} c="#fff" style={{ paddingTop: 12, paddingHorizontal: 20 }} accessibilityRole="header">
            {cim}
          </T>
          {al ? (
            <T m={15.5} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 6, paddingHorizontal: 20, maxWidth: 370 }}>
              {al}
            </T>
          ) : null}
        </Fejlec>
        <TeljesCtx.Provider value>
          <View style={{ paddingHorizontal: forma.margo, paddingTop: elsoLap ? 0 : 14 }}>{elemek}</View>
        </TeljesCtx.Provider>
      </ScrollView>
      <MintaJel />
    </KeyboardAvoidingView>
  );
}
