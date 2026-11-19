// The accountant's short letter exactly as the client sees it on the home screen (design 03):
// paper, 4 px corner, faint paper texture, "Kedves Kata!", body, printed name + date, handwritten signature.
import { datum } from '../lib/format';

export function Alairas({ path }: { path: string | null | undefined }) {
  if (!path) return null;
  return (
    <svg className="alairas" viewBox="0 0 210 78" aria-label="aláírás" role="img">
      <path d={path} />
    </svg>
  );
}

export function Level({
  megszolitas,
  szoveg,
  alairo,
  szerep = 'könyvelőd',
  datumIso,
  alairas,
}: {
  megszolitas: string;
  szoveg: string;
  alairo: string;
  szerep?: string;
  datumIso: string;
  alairas: string | null | undefined;
}) {
  return (
    <div className="level">
      <div className="megszolitas">{megszolitas}</div>
      <p>{szoveg}</p>
      <div className="alairas-sor">
        <div className="ki-irta">
          <div className="nev">{alairo}</div>
          <div className="mikor">
            {szerep}, {datum(datumIso)}
          </div>
        </div>
        <Alairas path={alairas} />
      </div>
    </div>
  );
}
