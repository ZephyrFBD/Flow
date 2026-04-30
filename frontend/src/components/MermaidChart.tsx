import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  theme: 'neutral',
  themeVariables: { fontSize: '14px' },
  startOnLoad: false,
});

interface Props {
  chart: string;
}

export default function MermaidChart({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !chart) return;
    const el = ref.current;
    el.innerHTML = `<div class="mermaid">${chart.replace(/</g, '&lt;')}</div>`;
    const target = el.firstElementChild as HTMLElement;
    if (!target) return;
    mermaid.run({ nodes: [target], suppressErrors: true }).catch(() => {
      el.innerHTML = '<p style="color:#999">图表示例加载失败</p>';
    });
  }, [chart]);

  return <div ref={ref} />;
}
