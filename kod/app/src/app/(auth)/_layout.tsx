import { Stack } from 'expo-router';
import { szin } from '@/theme/tokens';

export default function AuthElrendezes() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: szin.alap } }} />;
}
