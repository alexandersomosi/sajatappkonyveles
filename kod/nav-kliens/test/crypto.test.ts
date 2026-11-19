import { describe, expect, it } from 'vitest';
import { newRequestId, passwordHash, REQUEST_ID_RE, requestSignature, signatureTimestamp } from '../src/crypto.js';

// Expected values computed independently with Python hashlib (sha512 / sha3_512) and – for the
// signatures – identical to the requestSignature values printed in NAV's own sample requests
// (github.com/nav-gov-hu/Online-Invoice, "sample/API sample/*.xml", signKey in the XML comment).
const NAV_SAMPLE_KEY = 'ac-ac3a-7f661bff7d342N43CYX4U9FG';

describe('passwordHash (SHA-512, upper hex)', () => {
  it.each([
    ['Demo-jelszo-1', 'D10CAD560A6E8210F2143B3F40239DD92CB991070837721DDF1464A1506D3C2658E367101F25B45204099AB5E51C1E3680F5DA4FC5CA670CA74503662C5534B1'],
    ['árvíztűrő tükörfúrógép', '25BAEE1AA530F222FB3B413797853E2096A0AE0C3D44DD987C92D92F44EB3F45EE455D7F451A1AAC607B16340D88E6F4D6FC0D6D17ED6569883060E8F34CB82A'],
    ['demo-jelszo-68801234', 'E6EE4B13CCA0548D242BA1EE93CD1D246169379E3289B66003321B65DA54B3A2E04F3DC8EDCA714EC4E34FE9F02B850E7662CB97B4674065B988A2857710673D'],
  ])('%s', (pw, expected) => {
    expect(passwordHash(pw)).toBe(expected);
  });
});

describe('requestSignature (SHA3-512 partial authentication, upper hex)', () => {
  it.each([
    // queryTaxpayer.xml
    ['RID215118906689', '2019-09-11T11:11:08.579Z', 'C5ADE8A2231C509D2887E6C2C4406CC5F72CA25B070AD3E94FADFA3F91A8A3667AF882DEDC7D67E9086E3D34A95886E929ACD8C924CD1E8357C89BEF43BA9126'],
    // queryInvoiceData.xml
    ['RID005176453519', '2019-09-11T11:24:30.037Z', 'A3C2FE7C2068350B1B56B535ED1A4F8CA6C84AD5F19893556FFBD7B4655C79FBAC2A4BE271121174288B99BE2EDF5128028A67ACA1D0E883336362BF14E0BB39'],
    // queryInvoiceDigest_outbound_query_params.xml
    ['RID242585074285', '2019-09-11T12:16:48.177Z', 'DB5EB960D80F120F2EEE21F6F46E21FB47CE5925EB7E6F8A72CFC12A24F3E1AB1C5D17EBD60163933457108C8D46C2B297F2CE8357C973AEE76A68CA5F70B6C6'],
    // queryInvoiceChainDigest.xml
    ['RID802364680498', '2020-02-05T09:10:48.488Z', '27DF128E7E4D863E0B98F9A991219D0105DFBF7E8E7FFE3CC5182AAE3E04A3035BAEFAFC94CF25D011CAEAEECEC39C90F088DC5111F0197B7476FA0E2AF74070'],
  ])('NAV sample %s', (rid, ts, expected) => {
    expect(requestSignature(rid, ts, NAV_SAMPLE_KEY)).toBe(expected);
  });

  it('own vector (no milliseconds in the mask)', () => {
    expect(requestSignature('KJ00000000000000000000000001', '2026-11-17T05:30:00.000Z', 'kj-demo-alairokulcs-1')).toBe(
      '5E0A566169CDEC8A5F4501C32B89AFA3AB4A230D05BF4A7E7C98FF6696871D52181A24DFF8FEC7CD5340F09D84A61615129188BA96BD1D869579308D68DB9189',
    );
  });

  it('timestamp mask drops separators, millis and zone', () => {
    expect(signatureTimestamp('2026-11-17T05:30:00.000Z')).toBe('20261117053000');
    expect(signatureTimestamp('2026-01-02T23:59:59Z')).toBe('20260102235959');
    expect(() => signatureTimestamp('2026-11-17T06:30:00+01:00')).toThrow();
  });
});

describe('newRequestId', () => {
  it('matches the NAV pattern, is 28 chars, starts with KJ and is unique', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const id = newRequestId();
      expect(id).toMatch(REQUEST_ID_RE);
      expect(id).toHaveLength(28);
      expect(id.startsWith('KJ')).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(2000);
  });
});
