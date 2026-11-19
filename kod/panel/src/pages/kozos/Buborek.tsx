// One chat message (accountant thread and the service-team thread). Our side = me, the accountant or a team member;
// a colleague's message carries its name above ("Anna · ügyfélszolgálat", SPEC §26.4).
import * as ep from '../../api/endpoints';
import type { Message } from '../../api/types';
import { I3 } from '../../ui/Icon3d';
import { idopont } from '../../lib/format';
import { CERT_LABEL, REQUEST_TYPE_LABEL } from '../../lib/labels';
import { buborekOldal } from '../../lib/csapat';

export function Buborek({ m, t }: { m: Message; t: string }) {
  const { sajat: en, nev } = buborekOldal(m);
  if (m.kind === 'rendszer' || m.sender === 'rendszer')
    return (
      <div className="buborek rendszer">
        {m.body} · {idopont(m.createdAt, t)}
      </div>
    );
  if (m.kind === 'keres_kartya' && m.request) {
    const r = m.request;
    return (
      <>
        <div className={`keres-kartya${en ? ' en' : ''}`}>
          <I3 n={r.direction === 'konyvelotol' ? 'feltoltes' : 'igazolas'} s={40} />
          <div>
            <div className="halvany kicsi">{r.direction === 'konyvelotol' ? 'Kérésed' : 'Kérése'}</div>
            <div className="felkover" style={{ fontSize: 16 }}>
              {r.certificate ? `${CERT_LABEL[r.certificate.certificateType]}${r.certificate.year ? `, ${r.certificate.year}` : ''}` : r.title || REQUEST_TYPE_LABEL[r.type]}
            </div>
            <div className="halvany" style={{ fontSize: 14 }}>
              <b style={{ color: 'var(--tinta)' }}>{r.statusLabel}</b>
              {r.certificate?.purpose && `, cél: ${r.certificate.purpose}`}
            </div>
          </div>
        </div>
        <div className={`buborek-ido${en ? ' en' : ''}`}>{idopont(m.createdAt, t)}</div>
      </>
    );
  }
  return (
    <>
      {nev && <div className="buborek-nev en">{nev}</div>}
      <div className={`buborek ${en ? (nev ? 'en kollega' : 'en') : 'ugyfel'}`}>
        {m.body}
        {m.document && <div className="csatolmany">Irat: {m.document.title}</div>}
        {m.attachments.map((a) => (
          <div key={a.fileId}>
            <button className="csatolmany" onClick={() => void ep.downloadFile(a.fileId, a.displayName)}>
              {a.displayName}
            </button>
          </div>
        ))}
      </div>
      <div className={`buborek-ido${en ? ' en' : ''}`}>
        {idopont(m.createdAt, t)}
        {en && m.readByClientAt && ' · olvasta'}
      </div>
    </>
  );
}
