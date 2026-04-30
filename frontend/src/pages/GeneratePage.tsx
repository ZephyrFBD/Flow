import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card, Input, Button, Upload, Typography, Alert, Progress, Space, Tree, Radio,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { generateTree, refineTreeStream, parseSSEStream } from '../services/api';
import PdfUploader from '../components/PdfUploader';
import GradientText from '../components/GradientText';
import StarBorder from '../components/StarBorder';

const { TextArea } = Input;
const { Text } = Typography;

export default function GeneratePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refineTreeId = searchParams.get('refine');
  const deriveMode = searchParams.get('mode') === 'derive';

  const [prompt, setPrompt] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [refineMode, setRefineMode] = useState<'inplace' | 'derive'>(deriveMode ? 'derive' : 'inplace');

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<string | null>(null);
  const [nodeMap, setNodeMap] = useState<Map<string, { title: string; id: string; parentId: string | null }>>(new Map());
  const [llmMeta, setLlmMeta] = useState<{ duration_sec: number; input_tokens: number; output_tokens: number; thinking_tokens: number } | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveTokens, setLiveTokens] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const treeData = buildTreeFromMap(nodeMap);

  const handleGenerate = async () => {
    if (!prompt && !pdfFile) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setGenerating(true);
    setError(null);
    setProgress(0);
    setPhase('generating');
    setTreeId(null);
    setNodeMap(new Map());
    setLlmMeta(null);
    startTimeRef.current = Date.now();
    setLiveElapsed(0);
    setLiveTokens(0);
    timerRef.current = setInterval(() => {
      setLiveElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);

    try {
      const stream = refineTreeId
        ? await refineTreeStream(refineTreeId, prompt, pdfFile || undefined, refineMode, undefined, abort.signal)
        : await generateTree(prompt, pdfFile || undefined, undefined, abort.signal);
      const reader = stream.getReader();

      parseSSEStream(
        reader,
        (event, data) => {
          if (event === 'node_added' && data.node) {
            setNodeMap((prev) => {
              const next = new Map(prev);
              next.set(data.node.id, {
                title: data.node.title,
                id: data.node.id,
                parentId: data.parent_id || null,
              });
              return next;
            });
          } else if (event === 'progress') {
            setProgress(data.percent || 0);
            if (data.phase) setPhase(data.phase);
          } else if (event === 'token_progress') {
            setLiveElapsed(data.elapsed || 0);
            setLiveTokens(data.estimated_tokens || 0);
          } else if (event === 'tree_ready') {
            setTreeId(data.tree_id);
            setProgress(100);
            setPhase('complete');
          } else if (event === 'metadata') {
            setLlmMeta(data);
          } else if (event === 'error') {
            setError(data.message || '生成失败');
          }
        },
        () => { setGenerating(false); if (timerRef.current) clearInterval(timerRef.current); },
        (err) => { setError(err.message); setGenerating(false); if (timerRef.current) clearInterval(timerRef.current); }
      );
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || '生成请求失败');
      }
      setGenerating(false);
    }
  };

  const handleCancel = () => { abortRef.current?.abort(); setGenerating(false); if (timerRef.current) clearInterval(timerRef.current); };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <GradientText colors={['#5227FF', '#FF9FFC', '#B497CF']} animationSpeed={6}>
        <span style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, display: 'inline-block' }}>
          {refineTreeId ? '✏️ 用AI修改知识树' : '✨ 生成知识树'}
        </span>
      </GradientText>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {refineTreeId && (
          <div>
            <Text strong>修改模式</Text>
            <Radio.Group value={refineMode} onChange={(e) => setRefineMode(e.target.value)} style={{ marginLeft: 12 }}>
              <Radio value="inplace">原地更新 (直接修改当前树)</Radio>
              <Radio value="derive">衍生新版本 (保留原树)</Radio>
            </Radio.Group>
          </div>
        )}

        <div>
          <Text strong>Prompt <Text type="secondary">(可选)</Text></Text>
          <TextArea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={refineTreeId ? '输入修改要求，如：补充更多实际应用场景...' : '输入知识点主题，如：帮我整理线性代数的核心知识点...'}
            disabled={generating}
          />
        </div>

        <div>
          <Text strong>PDF 文件 <Text type="secondary">(可选)</Text></Text>
          <PdfUploader onFile={(f) => setPdfFile(f)} onRemove={() => setPdfFile(null)} disabled={generating} />
        </div>

        <Space>
          <StarBorder color="#5227FF" speed="8s" thickness={1} as="div" style={{ display: 'inline-block' }}>
            <div style={{ padding: '4px 0' }}>
              <Button type="primary" size="large" onClick={handleGenerate} loading={generating} disabled={!prompt && !pdfFile}>
                {generating ? '生成中...' : refineTreeId ? '✏️ 开始修改' : '✨ 生成知识树'}
              </Button>
            </div>
          </StarBorder>
          {generating && <Button onClick={handleCancel}>取消</Button>}
        </Space>

        {generating && (
          <Card size="small">
            <Progress percent={progress} status="active" />
            <Text type="secondary">
              {phase === 'generating' ? '正在调用 AI 生成知识树...' :
               phase === 'parsing' ? '正在解析结果...' :
               phase === 'rendering' ? '正在渲染节点...' :
               phase === 'complete' ? '生成完成!' : ''}
            </Text>
          </Card>
        )}

        {(generating || llmMeta) && (
          <Card size="small" className="meta-info-card">
            <Text type="secondary" style={{ fontSize: 13 }}>
              {llmMeta ? formatMeta(llmMeta) : formatLive(liveElapsed, liveTokens)}
            </Text>
          </Card>
        )}

        {error && <Alert type="error" message="生成失败" description={error} closable onClose={() => setError(null)} showIcon />}

        {treeData.length > 0 && (
          <StarBorder color="#B497CF" speed="12s" thickness={1} as="div">
            <Card
              title={`生成结果预览 (${nodeMap.size} 个节点)`}
              extra={treeId && <Button type="primary" onClick={() => navigate(`/tree/${treeId}`)}>📖 进入知识树</Button>}
            >
              <Tree showLine defaultExpandAll treeData={treeData} />
            </Card>
          </StarBorder>
        )}
      </Space>
    </div>
  );
}

function formatLive(sec: number, tokens: number): string {
  const timeStr = sec >= 60 ? `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s` : `${sec.toFixed(1)}s`;
  const tokenStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;
  return `(${timeStr} · ${tokenStr} tokens · generating...)`;
}

function formatMeta(m: { duration_sec: number; input_tokens: number; output_tokens: number; thinking_tokens: number }): string {
  const dur = m.duration_sec;
  const timeStr = dur >= 60 ? `${Math.floor(dur / 60)}m ${Math.floor(dur % 60)}s` : `${dur.toFixed(1)}s`;
  const totalTokens = m.input_tokens + m.output_tokens;
  const tokenStr = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k tokens` : `${totalTokens} tokens`;
  const thinkStr = m.thinking_tokens > 0 ? ` · thought ${Math.round(m.thinking_tokens / 50)}s` : '';
  return `(${timeStr} · ${tokenStr}${thinkStr})`;
}

function buildTreeFromMap(nodeMap: Map<string, { title: string; id: string; parentId: string | null }>): any[] {
  const childrenMap = new Map<string | null, any[]>();
  for (const [id, entry] of nodeMap) {
    const parentKey = entry.parentId || '__root__';
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push({ title: entry.title, key: id, id: entry.id });
  }
  function attachChildren(node: any) {
    const kids = childrenMap.get(node.key) || [];
    if (kids.length > 0) { node.children = kids; for (const kid of kids) attachChildren(kid); }
  }
  const roots = childrenMap.get('__root__') || [];
  for (const r of roots) attachChildren(r);
  return roots;
}
