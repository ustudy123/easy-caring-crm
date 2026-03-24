import { useRef, useState, ReactNode } from "react";

interface SwipeableCardProps {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onMoveNext?: () => void;
}

export function SwipeableCard({ children, onEdit, onDelete, onMoveNext }: SwipeableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const THRESHOLD = 70;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    // Clamp between -140 and 80
    const clamped = Math.max(-140, Math.min(80, diff));
    setOffset(clamped);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (offset < -THRESHOLD) {
      // Snapped left — show delete action
      setOffset(-130);
    } else if (offset > THRESHOLD && onMoveNext) {
      onMoveNext();
      setOffset(0);
    } else {
      setOffset(0);
    }
  };

  const resetSwipe = () => setOffset(0);

  return (
    <div className="relative overflow-hidden rounded-lg sm:overflow-visible">
      {/* Background actions revealed on swipe */}
      <div className="absolute inset-y-0 right-0 flex items-stretch sm:hidden">
        <button
          onClick={() => { onEdit(); resetSwipe(); }}
          className="flex w-[65px] items-center justify-center bg-primary text-primary-foreground text-xs font-bold"
        >
          ✏️ Editar
        </button>
        <button
          onClick={() => { onDelete(); resetSwipe(); }}
          className="flex w-[65px] items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold rounded-r-lg"
        >
          🗑️ Excluir
        </button>
      </div>

      {/* Foreground card */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10 bg-card transition-transform sm:!transform-none"
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? "none" : "transform 0.3s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
