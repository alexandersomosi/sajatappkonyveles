// A belépési folyamat egyszerű lapjai (regisztráció, jelszó, kód): tintakék sáv címmel, alatta fehér lap.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { szin } from '../theme/tokens';
import { Fejlec } from '../ui/alap';
import { MintaJel, vissza } from '../ui/keret';
import { T } from '../ui/T';
import { Pressable } from 'react-native';

export function AuthKeret({ cim, al, children, visszaCim = 'Vissza a belépéshez', visszaHova = '/belepes', felso }: { cim: string; al?: string; children: ReactNode; visszaCim?: string | null; visszaHova?: string; felso?: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: szin.alap }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>{children}</View>
      </ScrollView>
      <MintaJel />
    </KeyboardAvoidingView>
  );
}
