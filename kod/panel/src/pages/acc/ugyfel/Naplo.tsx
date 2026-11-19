// Napló of one client: who did what, when (FUNKCIOK 28).
import type { FulProps } from '../UgyfelAdatlap';
import { NaploTabla } from '../../kozos/NaploTabla';
import * as ep from '../../../api/endpoints';

export default function Naplo({ c }: FulProps) {
  return <NaploTabla kulcs={['acc', 'audit', c.id]} lekero={(cursor) => ep.accAudit({ clientId: c.id, cursor })} ugyfelOszlop={false} />;
}
