import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  theme: 'neutral',
  themeVariables: {
    fontSize: '14px',
  },
  startOnLoad: false,
});

interface Props {
  chart: string;
}

export default function MermaidChart({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !chart) return;
    const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
    mermaid.render(id, chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch(() => {
      if (ref.current) ref.current.innerHTML = '<p style="color:#999">图表示例加载失败</p>';
    });
  }, [chart]);

  return <div ref={ref} />;
}
