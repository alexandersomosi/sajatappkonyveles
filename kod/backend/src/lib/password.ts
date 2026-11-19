// argon2id password hashing (OWASP minimum: m = 19 456 KiB, t = 2, p = 1) and the password rule
// (SPEC §4.1): 10–128 characters, not a common password, not the user's own e-mail.
import { Algorithm, hash, verify } from '@node-rs/argon2';

const OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(pw: string): Promise<string> {
  return hash(pw, OPTS);
}

export async function verifyPassword(stored: string | null | undefined, pw: string): Promise<boolean> {
  if (!stored) {
    // Spend comparable time so a missing account is not distinguishable by timing.
    await hash(pw, OPTS).catch(() => undefined);
    return false;
  }
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

// Passwords shorter than 10 characters are rejected by length, so the embedded list only needs
// the common ones of 10+ characters (from public breach top lists) plus Hungarian variants.
// The patterns below catch the long tail (repeats, sequences, keyboard rows).
const COMMON = new Set(
  `1234567890 0123456789 0987654321 9876543210 1111111111 0000000000 1234512345 1234567891 12345678910
123456789a a123456789 1q2w3e4r5t 1q2w3e4r5t6y q1w2e3r4t5 qwertyuiop qwertzuiop asdfghjkl1 zxcvbnm123
qwerty1234 qwerty12345 qwertz1234 1qaz2wsx3edc 1qazxsw2 zaq12wsxcde qazwsxedc123 password12 password123
password1234 passw0rd12 p@ssword123 p@ssw0rd123 iloveyou12 iloveyou123 princess12 sunshine12 football12
baseball12 superman12 starwars12 dragon1234 monkey1234 letmein123 welcome123 welcome1234 admin12345
administrator abc1234567 abcdefghij abcd123456 aaaaaaaaaa qqqqqqqqqq michael123 charlie123 jordan1234
computer12 internet12 trustno123 whatever12 freedom123 shadow1234 master1234 hello12345 helloworld
jelszo1234 jelszo12345 jelszavam1 jelszo2024 jelszo2025 jelszo2026 jelszo123456 titkos1234 titok12345
magyarorszag budapest123 budapest12 szeretlek1 szeretlek12 szeretlek123 kiskutya12 cicamica12 macska1234
kutyus1234 hungary123 ferencvaros fradi12345 debrecen123 szeged12345 kezjegy123 kezjegy1234 konyvelo123
konyveles1 egyeni12345 vallalkozo1 vallalkozas qwer123456 asdf123456 zxcv123456 1234qwerasdf
123qweasdzxc qweasdzxc1 1q2w3e4r5t6y7u 123123123123 123321123321 112233445566 121212121212 1234abcd1234
passwordpassword changeme123 default1234 summer2024 summer2025 winter2025 spring2026 autumn2026
kezjegy2026 kezjegy2025`
    .split(/\s+/)
    .filter(Boolean),
);

function isSequence(s: string): boolean {
  const rows = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'qwertzuiop', 'asdfghjkl', 'yxcvbnm', 'zxcvbnm'];
  const low = s.toLowerCase();
  for (const r of rows) {
    const rr = r + r;
    const rev = [...rr].reverse().join('');
    if (low.length >= 6 && (rr.includes(low) || rev.includes(low))) return true;
  }
  return false;
}

/** Hungarian error message, or null when the password is acceptable. */
export function passwordProblem(pw: string, email?: string): string | null {
  if (typeof pw !== 'string' || pw.length < 10) return 'Legalább 10 karakter legyen.';
  if (pw.length > 128) return 'Legfeljebb 128 karakter lehet.';
  const low = pw.toLowerCase();
  if (COMMON.has(low)) return 'Ez túl gyakori jelszó. Válassz egy kevésbé kitalálhatót.';
  if (/^(.)\1+$/.test(pw)) return 'Ne ugyanaz a karakter ismétlődjön.';
  if (/^(.{1,4})\1{2,}$/.test(pw)) return 'Ez túl könnyen kitalálható minta.';
  if (isSequence(pw)) return 'Ez túl könnyen kitalálható sorozat.';
  if (email) {
    const e = email.toLowerCase();
    const local = e.split('@')[0] ?? '';
    if (low === e || (local.length >= 4 && low.includes(local))) return 'Ne az e-mail-címed legyen benne.';
  }
  return null;
}
