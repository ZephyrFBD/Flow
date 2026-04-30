import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface Props {
  value: number;
  duration?: number;
  suffix?: string;
  style?: React.CSSProperties;
}

export default function AnimatedCounter({ value, duration = 1.5, suffix = '', style }: Props) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(start + diff * ease));
      if (t < 1) frameRef.current = requestAnimationFrame(animate);
      else prevRef.current = value;
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return <span style={style}>{display}{suffix}</span>;
}
