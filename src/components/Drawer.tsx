import type { ReactNode } from 'react';

interface Props {
  side: 'left' | 'right';
  width: string; // Tailwind width class, e.g. "w-56"
  onClose: () => void;
  children: ReactNode;
}

/** A simple overlay drawer for the narrow breakpoints, where a pane collapses
 * behind a toggle instead of sitting inline (BUILD §9). */
export function Drawer({ side, width, onClose, children }: Props) {
  return (
    <div className="fixed inset-0 z-20 font-sans">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        className={`absolute top-0 ${side === 'left' ? 'left-0' : 'right-0'} h-full ${width} max-w-[90%] overflow-y-auto border-border-strong bg-surface-2 text-text shadow-card ${
          side === 'left' ? 'border-r' : 'border-l'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
