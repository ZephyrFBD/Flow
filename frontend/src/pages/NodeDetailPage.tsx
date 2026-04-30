import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Space, Checkbox, Tag, Button, Skeleton, Empty, List, message, Input,
} from 'antd';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PlusOutlined } from '@ant-design/icons';
import { getTree, updateNode, generateQuestions, parseSSEStream } from '../services/api';
import type { KnowledgeNode, ExampleQuestion, QuestionConfig } from '../types';
import QuestionForm from '../components/QuestionForm';
import MermaidChart from '../components/MermaidChart';
import GradientText from '../components/GradientText';
import StarBorder from '../components/StarBorder';

const { Text } = Typography;

const EXAMPLE_DIAGRAMS: Record<string, string> = {
  '矩阵': `flowchart LR
    A[矩阵] --> B[加法]
    A --> C[乘法]
    A --> D[转置]`,
  '行列式': `flowchart LR
    A[行列式] --> B[定义]
    A --> C[性质]
    A --> D[计算]
    C --> E[克拉默法则]`,
  '特征值': `flowchart TD
    A[特征值] --> B[特征多项式]
    A --> C[特征向量]
    B --> D[求解特征值]
    C --> E[求解特征向量]
    D --> F[矩阵对角化]`,
  '线性代数': `flowchart TD
    A[线性代数] --> B[矩阵运算]
    A --> C[行列式]
    A --> D[特征值]
    A --> E[向量空间]`,
};

export default function NodeDetailPage() {
  const { treeId, nodeId } = useParams<{ treeId: string; nodeId: string }>();
  const navigate = useNavigate();
  const [node, setNode] = useState<KnowledgeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingQ, setGeneratingQ] = useState(false);
  const [questions, setQuestions] = useState<ExampleQuestion[]>([]);
  const [llmMeta, setLlmMeta] = useState<{ duration_sec: number; input_tokens: number; output_tokens: number; thinking_tokens: number } | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveTokens, setLiveTokens] = useState(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDescVal, setEditDescVal] = useState('');
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [editKeywordsVal, setEditKeywordsVal] = useState('');

  useEffect(() => {
    if (!treeId || !nodeId) return;
    setLoading(true);
    getTree(treeId).then((data) => {
      const found = findNode(data.nodes, nodeId);
      setNode(found || null);
      setQuestions(data.questions.filter((q) => q.node_id === nodeId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [treeId, nodeId]);

  const handleToggleComplete = async () => {
    if (!treeId || !nodeId || !node) return;
    try {
      const updated = await updateNode(treeId, nodeId, { completed: !node.completed });
      const found = findNode(updated.nodes, nodeId);
      setNode(found || null);
    } catch { /* ok */ }
  };

  const handleGenerateQuestions = async (config: QuestionConfig) => {
    if (!treeId || !nodeId || !node) return;
    setGeneratingQ(true);
    setLlmMeta(null);
    setLiveElapsed(0);
    setLiveTokens(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setLiveElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);
    try {
      const stream = await generateQuestions({
        tree_id: treeId,
        node_id: nodeId,
        types: config.types,
        count: config.count,
        difficulty: config.difficulty,
        extra_requirements: config.extra_requirements,
      });
      const reader = stream.getReader();
      parseSSEStream(
        reader,
        (event, data) => {
          if (event === 'question_added') {
            setQuestions((prev) => [...prev, data]);
          } else if (event === 'token_progress') {
            setLiveElapsed(data.elapsed || 0);
            setLiveTokens(data.estimated_tokens || 0);
          } else if (event === 'metadata') {
            setLlmMeta(data);
          }
        },
        () => { setGeneratingQ(false); if (timerRef.current) clearInterval(timerRef.current); },
        () => { setGeneratingQ(false); if (timerRef.current) clearInterval(timerRef.current); }
      );
    } catch {
      setGeneratingQ(false);
    }
  };

  const handleRename = async () => {
    if (!treeId || !nodeId || !editTitleVal.trim()) return;
    try {
      await updateNode(treeId, nodeId, { title: editTitleVal.trim() });
      setNode((prev) => prev ? { ...prev, title: editTitleVal.trim() } : prev);
      setEditingTitle(false);
      message.success('已重命名');
    } catch { message.error('重命名失败'); }
  };

  const handleSaveDesc = async () => {
    if (!treeId || !nodeId) return;
    try {
      const updated = await updateNode(treeId, nodeId, { description: editDescVal });
      const found = findNode(updated.nodes, nodeId);
      setNode(found || null);
      setEditingDesc(false);
      message.success('描述已更新');
    } catch { message.error('更新失败'); }
  };

  const handleSaveKeywords = async () => {
    if (!treeId || !nodeId) return;
    const kws = editKeywordsVal.split(/[,，、\s]+/).filter(Boolean);
    try {
      const updated = await updateNode(treeId, nodeId, { keywords: kws });
      const found = findNode(updated.nodes, nodeId);
      setNode(found || null);
      setEditingKeywords(false);
      message.success('关键词已更新');
    } catch { message.error('更新失败'); }
  };

  const handleStartEditDesc = () => {
    setEditDescVal(node?.description || '');
    setEditingDesc(true);
  };

  const handleStartEditKeywords = () => {
    setEditKeywordsVal((node?.keywords || []).join(', '));
    setEditingKeywords(true);
  };

  const wrongQuestions = questions.filter((q) => q.is_correct === false);
  const hasWrongQuestions = wrongQuestions.length > 0;

  // Find a matching diagram for this node
  const diagram = Object.entries(EXAMPLE_DIAGRAMS).find(
    ([key]) => node?.title.includes(key) || node?.keywords?.includes(key)
  )?.[1];

  if (loading) return <Skeleton active style={{ padding: 48 }} />;
  if (!node) return <Empty description="节点未找到" />;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="link" onClick={() => navigate(`/tree/${treeId}`)}>← 返回知识树</Button>
        <Text type="secondary"> / {node.title}</Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {editingTitle ? (
          <Space>
            <Input
              value={editTitleVal}
              onChange={(e) => setEditTitleVal(e.target.value)}
              onPressEnter={handleRename}
              style={{ width: 300 }}
              autoFocus
            />
            <Button size="small" type="primary" onClick={handleRename}>保存</Button>
            <Button size="small" onClick={() => setEditingTitle(false)}>取消</Button>
          </Space>
        ) : (
          <GradientText colors={['#5227FF', '#FF9FFC', '#B497CF']} animationSpeed={6}>
            <span style={{ fontSize: 24, fontWeight: 700, cursor: 'pointer' }}
              onClick={() => { setEditTitleVal(node.title); setEditingTitle(true); }}
            >
              {node.title} ✎
            </span>
          </GradientText>
        )}
        <Checkbox checked={node.completed} onChange={handleToggleComplete}>
          已完成
        </Checkbox>
      </div>

      {/* Keywords */}
      {editingKeywords ? (
        <div style={{ marginBottom: 16 }}>
          <Space style={{ width: '100%' }} direction="vertical">
            <Input
              value={editKeywordsVal}
              onChange={(e) => setEditKeywordsVal(e.target.value)}
              placeholder="输入关键词，用逗号分隔"
              onPressEnter={handleSaveKeywords}
              autoFocus
            />
            <Space>
              <Button size="small" type="primary" onClick={handleSaveKeywords}>保存</Button>
              <Button size="small" onClick={() => setEditingKeywords(false)}>取消</Button>
            </Space>
          </Space>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <Space>
            {(node.keywords?.length > 0 ? node.keywords : ['无关键词']).map((kw) => (
              <Tag key={kw} color={kw === '无关键词' ? 'default' : undefined}>{kw}</Tag>
            ))}
            <Button type="link" size="small" icon={<PlusOutlined />} onClick={handleStartEditKeywords}>
              编辑关键词
            </Button>
          </Space>
        </div>
      )}

      {/* Description */}
      {editingDesc ? (
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.TextArea
              value={editDescVal}
              onChange={(e) => setEditDescVal(e.target.value)}
              rows={8}
              autoFocus
            />
            <Space>
              <Button type="primary" size="small" onClick={handleSaveDesc}>保存</Button>
              <Button size="small" onClick={() => setEditingDesc(false)}>取消</Button>
            </Space>
          </Space>
        </Card>
      ) : (
        <StarBorder color="#5227FF" speed="12s" thickness={1} as="div">
          <Card
            style={{ marginBottom: 16 }}
            extra={<Button type="link" size="small" onClick={handleStartEditDesc}>编辑</Button>}
          >
            <div style={{ fontSize: 15, lineHeight: 1.8, minHeight: 40 }}>
              {node.description ? (
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {node.description}
                </ReactMarkdown>
              ) : (
                <Text type="secondary">暂无讲解内容</Text>
              )}
            </div>
          </Card>
        </StarBorder>
      )}

      {/* Mermaid diagram */}
      {diagram && (
        <Card title="📊 结构示意图" size="small" style={{ marginBottom: 16 }}>
          <MermaidChart chart={diagram} />
        </Card>
      )}

      <QuestionForm onGenerate={handleGenerateQuestions} loading={generatingQ} />

      {(generatingQ || llmMeta) && (
        <Card size="small" className="meta-info-card" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {llmMeta ? formatMeta(llmMeta) : formatLive(liveElapsed, liveTokens)}
          </Text>
        </Card>
      )}

      {questions.length > 0 && (
        <Card
          title={`已生成题目 (${questions.length}道)`}
          extra={
            hasWrongQuestions && (
              <Button size="small" onClick={() => {
                const firstWrong = wrongQuestions[0];
                navigate(`/practice/${firstWrong.id}?wrong=1&treeId=${treeId}&nodeId=${nodeId}`);
              }}>
                📕 错题复习 ({wrongQuestions.length})
              </Button>
            )
          }
        >
          <List
            dataSource={questions}
            renderItem={(q, idx) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                <List.Item
                  actions={[
                    <Button key="practice" type="link" onClick={() => {
                      const params = new URLSearchParams({ treeId: treeId!, nodeId: nodeId! });
                      navigate(`/practice/${q.id}?${params}`);
                    }}>
                      {q.is_correct !== null || q.ai_score !== null ? '继续答题' : '去答题'}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={q.type === 'choice' ? 'blue' : 'orange'}>
                          {q.type === 'choice' ? '选择题' : '解答题'}
                        </Tag>
                        <Text>{q.question}</Text>
                        {q.is_correct === true && <Tag color="green">✅ 正确</Tag>}
                        {q.is_correct === false && <Tag color="red">❌ 错误</Tag>}
                        {q.is_correct === null && q.ai_score !== null && <Tag color="blue">📝 {q.ai_score}/10</Tag>}
                      </Space>
                    }
                    description={q.difficulty === 'easy' ? '简单' : q.difficulty === 'hard' ? '困难' : '中等'}
                  />
                </List.Item>
              </motion.div>
            )}
          />
        </Card>
      )}
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

function findNode(node: KnowledgeNode, id: string): KnowledgeNode | null {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}
