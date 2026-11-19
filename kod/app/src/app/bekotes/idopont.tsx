// Az időpontfoglalás megszűnt (SPEC §26.2): a régi útvonal a visszahívás-kérésre visz. A régi képernyő: _regi/src_par26/.
import { Redirect } from 'expo-router';

export default function RegiIdopont() {
  return <Redirect href={{ pathname: '/visszahivas', params: { forras: 'bekotes', tema: 'bekotes' } }} />;
}
