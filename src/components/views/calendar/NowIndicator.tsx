import { useState, useEffect } from 'react';
import { timeToPx } from './calendarUtils';

interface Props {
  dayStart: Date;
  hourHeight: number;
}

export const NowIndicator = ({ dayStart, hourHeight }: Props) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const top = timeToPx(now.getTime(), dayStart, hourHeight);
  if (top < 0 || top > 24 * hourHeight) return null;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top, transform: 'translateY(-50%)' }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1 relative z-10" />
        <div className="flex-1 h-[1.5px] bg-red-500" />
      </div>
    </div>
  );
};
