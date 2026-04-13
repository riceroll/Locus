import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TOOLTIPS } from '../../lib/tooltips';

interface TooltipProps {
  /** Key into the TOOLTIPS config. */
  id: string;
  children: React.ReactNode;
  /** Hover delay in ms before the tooltip appears. Default 600. */
  delay?: number;
}

export function Tooltip({ id, children, delay = 600 }: TooltipProps) {
  const tip = TOOLTIPS[id];
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  if (!tip) return <>{children}</>;

  const show = () => {
    timerRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
      }
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div ref={containerRef} className="inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && pos && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
        >
          <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg shadow-xl px-3 py-2 max-w-[220px] text-left">
            <p className="text-[11px] font-bold mb-0.5 whitespace-nowrap">{tip.title}</p>
            <p className="text-[11px] leading-relaxed opacity-80">{tip.body}</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
