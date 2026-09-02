import { useEffect, useState } from 'react';

// Mirrors the design handoff's one breakpoint (Tailwind's `desktop: 860px`,
// tailwind.config.js). Below it, the phone layout (WORK 12.7).
const QUERY = '(max-width: 859.98px)';

function matches(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/**
 * Pure CSS handles most of the phone/desktop split (Tailwind's `desktop:`
 * variant), but which *component* mounts — the docked `PinCard` versus the
 * compact phone strip, the wishlist panel existing at all — can't be
 * expressed as a class. This is the seam for that: a hook, not a prop, so
 * every consumer reacts to the same breakpoint without threading window
 * width through the tree.
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setPhone(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return phone;
}
