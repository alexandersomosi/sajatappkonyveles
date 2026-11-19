// Poster still (bekotes_poszter.jpg, 1080x1920). Everything that must be read sits inside y 660-1260, which survives both
// No product name / wordmark (owner order 6, 11-19 fix). The 200 pt card crop on the onboarding page (~1.8:1 cover crop) and a 4:5 crop (y 285-1635), SPEC §26.7.1 / §26.7.3.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { BETU, C, Fulsor, M, Rozetta, useGeist } from './elemek';

export const Poszter: React.FC = () => {
  useGeist();
  return (
    <AbsoluteFill style={{ background: C.tintakek, fontFamily: BETU, overflow: 'hidden' }}>
      <Rozetta x={540} y={860} meret={1500} />
      <div style={{ position: 'absolute', left: M + 20, right: M + 20, top: 680, textAlign: 'center', color: '#FFFFFF' }}>
        <div style={{ fontSize: 44, fontWeight: 600, color: C.fejlecHalvany, marginBottom: 18 }}>Bemutató videó</div>
        <div style={{ fontSize: 104, fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.03em' }}>Így kezdünk</div>
        <div style={{ fontSize: 50, fontWeight: 500, color: C.fejlecHalvany, marginTop: 20 }}>Mire jó, és mi kell a bekötéshez</div>
      </div>
      <div style={{ position: 'absolute', left: M, right: M, top: 1040 }}>
        <Fulsor />
      </div>
    </AbsoluteFill>
  );
};
