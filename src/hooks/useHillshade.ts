import { useSyncExternalStore } from 'react';
import {
  readHillshade,
  setHillshade,
  subscribeHillshade,
} from '../lib/map-config';

/**
 * Terrain shading on or off (WORK 35), as a hook rather than a prop: the
 * `AccountPanel` that writes it opens *over the editor*, so the map behind
 * it has to follow, and `MapPane` is several levels down a `TripEditor`
 * that has no other reason to know about shading. Same reasoning as
 * `useIsPhone` — one external value, every consumer reacting to it.
 */
export function useHillshade(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeHillshade, readHillshade);
  return [on, setHillshade];
}
