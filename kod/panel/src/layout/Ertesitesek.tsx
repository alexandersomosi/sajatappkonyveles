// Staff in-panel notifications (SPEC §27.8: client_path_changed, assist_task, assist_approval_overdue … are "in-panel
// badge" kinds; GET /me/notifications, POST /me/notifications/read). A sidebar item with the unread count and a drawer.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../api/endpoints';
import { Fiok, HibaSav, Toltes, Ures } from '../ui/kozos';
import { I3 } from '../ui/Icon3d';
import { idopont } from '../lib/format';
import { today } from '../lib/today';

export function Ertesitesek() {
  const [nyitva, setNyitva] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'notifications'], queryFn: () => ep.meNotifications(), staleTime: 30_000, refetchInterval: 60_000 });
  const olvas = useMutation({
    mutationFn: (b: { ids?: string[]; all?: boolean }) => ep.meNotificationsRead(b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me', 'notifications'] }),
  });
  const items = q.data?.items ?? [];
  const olvasatlan = items.filter((i) => !i.readAt).length;
  const t = today();
  return (
    <>
      <button type="button" className="nav-elem ertesites-gomb" onClick={() => setNyitva(true)} title={olvasatlan ? `${olvasatlan} olvasatlan értesítés` : 'Értesítések'}>
        <I3 n="ertesites" s={28} />
        Értesítések
        {olvasatlan > 0 && <span className="db">{olvasatlan}</span>}
      </button>
      {/* the sidebar is its own stacking context: the drawer goes to <body>, above the page */}
      {createPortal(
      <Fiok
        nyitva={nyitva}
        bezar={() => setNyitva(false)}
        ikon="ertesites"
        cim="Értesítések"
        bev="Ami nálad történt: új teendő, lejáró határidő, módosított válasz."
        lab={
          olvasatlan > 0 ? (
            <button className="gomb-m csak-szoveg" disabled={olvas.isPending} onClick={() => olvas.mutate({ all: true })}>
              Mind olvasott
            </button>
          ) : undefined
        }
      >
        {q.isPending ? (
          <Toltes />
        ) : q.isError ? (
          <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        ) : items.length === 0 ? (
          <Ures n="level_boritek" cim="Nincs értesítésed" />
        ) : (
          <ul className="ertesites-lista">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={n.readAt ? '' : 'uj'}
                  onClick={() => {
                    if (!n.readAt) olvas.mutate({ ids: [n.id] });
                    if (n.link && n.link.startsWith('/')) {
                      setNyitva(false);
                      nav(n.link);
                    }
                  }}
                >
                  <span className="cim">{n.title}</span>
                  <span className="szoveg">{n.body}</span>
                  <span className="mikor">{idopont(n.createdAt, t)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Fiok>,
        document.body,
      )}
    </>
  );
}
