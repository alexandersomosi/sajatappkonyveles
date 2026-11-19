import React from 'react';
import { Composition, Still } from 'remotion';
import adat from './adat.json';
import { BekotesVideo } from './Bekotes';
import { Poszter } from './Poszter';
import { H, W } from './elemek';

export const Root: React.FC = () => (
  <>
    <Composition id="Bekotes" component={BekotesVideo} durationInFrames={adat.hossz} fps={adat.fps} width={W} height={H} />
    <Still id="Poszter" component={Poszter} width={W} height={H} />
  </>
);
