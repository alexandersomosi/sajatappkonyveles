// k5 nyitott #2 (major): az új vállalkozás képernyői csak az „inditas” úton nyílnak meg. Aki közben „van” útra váltott
// (vagy a böngésző Vissza gombja ide hozta), a Főoldalra (bekötés) kerül, nem a régi útnak szóló képernyőre.
import type { ComponentType } from 'react';
import { Redirect } from 'expo-router';
import { useOnboarding } from '../api/hooks';

export function csakInditasUton<P extends object>(Kepernyo: ComponentType<P>) {
  return function Vedett(p: P) {
    const o = useOnboarding();
    if (o.data && o.data.path !== 'inditas') return <Redirect href="/bekotes" />;
    return <Kepernyo {...p} />;
  };
}
