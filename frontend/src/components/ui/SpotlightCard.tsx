import { motion } from 'motion/react';
import type { ReactNode, MouseEvent } from 'react';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function SpotlightCard({ children, onClick, style }: Props) {
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--spotlight-x', `${x}%`);
    e.currentTarget.style.setProperty('--spotlight-y', `${y}%`);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        background: 'linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(22,119,255,0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
          transition: 'background 0.2s',
        }}
      />
      {children}
    </motion.div>
  );
}
