// Az Expo Router beépített /_sitemap oldala minden belső útvonalat kilistázna: élesben nem kell, a főoldalra visz.
import { Redirect } from 'expo-router';

export default function NincsOldalterkep() {
  return <Redirect href="/" />;
}
