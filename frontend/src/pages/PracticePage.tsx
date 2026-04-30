import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Typography, Button, Space, Tag, Progress, Skeleton, Alert } from 'antd';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { submitAnswer, parseSSEStream, getTree, updateQuestion } from '../services/api';
import type { ExampleQuestion } from '../types';
import ChoiceQuestion from '../components/ChoiceQuestion';
import EssayQuestion from '../components/EssayQuestion';
import GradientText from '../components/GradientText';
import StarBorder from '../components/StarBorder';

const { Text } = Typography;

export default function PracticePage() {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const treeId = searchParams.get('treeId');
  const nodeId = searchParams.get('nodeId');
  const wrongMode = searchParams.get('wrong') === '1';

  const [question, setQuestion] = useState<ExampleQuestion | null>(null);
  const [allQuestions, setAllQuestions] = useState<ExampleQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userAnswer, setUserAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [llmMeta, setLlmMeta] = useState<{ duration_sec: number; input_tokens: number; output_tokens: number; thinking_tokens: number } | null>(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveTokens, setLiveTokens] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCorrectRef = useRef<boolean | null>(null);
  const aiScoreRef = useRef<number | null>(null);
  const explanationRef = useRef('');
  const suggestionRef = useRef('');

  useEffect(() => {
    if (!questionId) return;
    setLoading(true);
    const load = async () => {
      let questions: ExampleQuestion[] = [];
      if (treeId) {
        const tree = await getTree(treeId);
        const nodeQuestions = tree.questions.filter((q) => !nodeId || q.node_id === nodeId);
        questions = wrongMode ? nodeQuestions.filter((q) => q.is_correct === false) : nodeQuestions;
      }
      setAllQuestions(questions);
      const idx = questions.findIndex((q) => q.id === questionId);
      const q = questions[idx] || null;
      setCurrentIndex(idx >= 0 ? idx : 0);
      setQuestion(q);
      if (q?.user_answer) {
        setUserAnswer(q.user_answer);
        if (q.is_correct !== null) {
          setSubmitted(true);
          setIsCorrect(q.is_correct);
          setAiScore(q.ai_score);
          setExplanation(q.explanation || '');
          setSuggestion(q.suggestion || '');
        } else {
          setSubmitted(false);
          setIsCorrect(null);
          setAiScore(null);
          setExplanation('');
          setSuggestion('');
        }
      } else {
        setUserAnswer('');
        setSubmitted(false);
        setIsCorrect(null);
        setAiScore(null);
        setSuggestion('');
        setExplanation('');
      }
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, [questionId, treeId, nodeId, wrongMode]);

  const handleSubmit = useCallback(async () => {
    if (!questionId || !question || !userAnswer.trim()) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setEvaluating(true);
    setSubmitted(true);
    setExplanation('');
    setLlmMeta(null);
    setLiveElapsed(0);
    setLiveTokens(0);
    startTimeRef.current = Date.now();
    isCorrectRef.current = null;
    aiScoreRef.current = null;
    explanationRef.current = '';
    suggestionRef.current = '';
    timerRef.current = setInterval(() => {
      setLiveElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);
    try {
      const stream = await submitAnswer(questionId, userAnswer, abort.signal);
      const reader = stream.getReader();
      parseSSEStream(
        reader,
        (event, data) => {
          if (event === 'judgment_start') {
            if (data.type === 'choice') { setIsCorrect(data.correct); isCorrectRef.current = data.correct; }
          } else if (event === 'token_progress') {
            setLiveElapsed(data.elapsed || 0);
            setLiveTokens(data.estimated_tokens || 0);
          } else if (event === 'explanation_chunk') {
            setExplanation((prev) => prev + (data.text || ''));
            explanationRef.current += (data.text || '');
          } else if (event === 'essay_feedback') {
            setAiScore(data.score); aiScoreRef.current = data.score;
            setSuggestion(data.suggestion || '');
            suggestionRef.current = data.suggestion || '';
          } else if (event === 'metadata') {
            setLlmMeta(data);
          }
        },
        () => {
          setEvaluating(false);
          if (timerRef.current) clearInterval(timerRef.current);
          // Save results to the tree
          if (questionId) updateQuestion(questionId, {
            user_answer: userAnswer,
            is_correct: isCorrectRef.current ?? undefined,
            ai_score: aiScoreRef.current ?? undefined,
            explanation: explanationRef.current || undefined,
            suggestion: suggestionRef.current || undefined,
          }).catch(() => {});
        },
        () => {
          setEvaluating(false);
          if (timerRef.current) clearInterval(timerRef.current);
          // Save results to the tree
          if (questionId) updateQuestion(questionId, {
            user_answer: userAnswer,
            is_correct: isCorrectRef.current ?? undefined,
            ai_score: aiScoreRef.current ?? undefined,
            explanation: explanationRef.current || undefined,
            suggestion: suggestionRef.current || undefined,
          }).catch(() => {});
        }
      );
    } catch { setEvaluating(false); }
  }, [questionId, question, userAnswer]);

  const handleNavigate = (dir: 'prev' | 'next') => {
    const newIdx = dir === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIdx < 0 || newIdx >= allQuestions.length) return;
    const nextQ = allQuestions[newIdx];
    const params = new URLSearchParams();
    if (treeId) params.set('treeId', treeId);
    if (nodeId) params.set('nodeId', nodeId);
    if (wrongMode) params.set('wrong', '1');
    navigate(`/practice/${nextQ.id}?${params.toString()}`);
  };

  if (loading) return <Skeleton active style={{ padding: 48 }} />;
  if (!question) return <Alert type="warning" message="题目未找到" showIcon />;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allQuestions.length - 1;
  const correctCount = allQuestions.filter((q) => q.is_correct === true).length;
  const answeredCount = allQuestions.filter((q) => q.is_correct !== null).length;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Button type="link" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← 返回</Button>

      {allQuestions.length > 1 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>第 {currentIndex + 1} / {allQuestions.length} 题</Text>
            <Text type="secondary">✅ {correctCount}  ❌ {answeredCount - correctCount}</Text>
          </Space>
          <Progress percent={Math.round((answeredCount / allQuestions.length) * 100)} size="small" format={() => `${answeredCount}/${allQuestions.length}`} />
        </Card>
      )}

      <StarBorder color="#5227FF" speed="10s" thickness={1} as="div">
        <Card>
          <Space style={{ marginBottom: 16 }}>
            <Tag color={question.type === 'choice' ? 'blue' : 'orange'}>
              {question.type === 'choice' ? '选择题' : '解答题'}
            </Tag>
            <Tag>{question.difficulty === 'easy' ? '简单' : question.difficulty === 'hard' ? '困难' : '中等'}</Tag>
            {wrongMode && <Tag color="red">错题复习</Tag>}
          </Space>
          <Text strong style={{ fontSize: 18, display: 'block', marginBottom: 16 }}>{question.question}</Text>

          {question.type === 'choice' && question.options && (
            <ChoiceQuestion
              options={question.options}
              value={userAnswer}
              onChange={setUserAnswer}
              disabled={submitted}
            />
          )}

          {question.type === 'essay' && (
            <EssayQuestion
              value={userAnswer}
              onChange={setUserAnswer}
              disabled={submitted}
            />
          )}

          {!submitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Space style={{ marginTop: 16 }}>
                <Button type="primary" size="large" onClick={handleSubmit} loading={evaluating}
                  disabled={!userAnswer.trim()}>
                  提交答案
                </Button>
                {evaluating && <Button onClick={() => { abortRef.current?.abort(); setEvaluating(false); }}>取消</Button>}
              </Space>
            </motion.div>
          )}
        </Card>
      </StarBorder>

      {(evaluating || llmMeta) && (
        <Card size="small" className="meta-info-card" style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {llmMeta ? formatMeta(llmMeta) : formatLive(liveElapsed, liveTokens)}
          </Text>
        </Card>
      )}

      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <StarBorder color="#B497CF" speed="12s" thickness={1} as="div">
            <Card style={{ marginTop: 16 }}>
              {isCorrect !== null && (
                <Alert type={isCorrect ? 'success' : 'error'} message={isCorrect ? '✅ 正确!' : '❌ 错误'} showIcon style={{ marginBottom: 16 }} />
              )}
              {aiScore !== null && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>AI 评分: </Text>
                  <Text style={{ fontSize: 20, fontWeight: 700 }}>{aiScore}/10</Text>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <Text strong>解析:</Text>
                <div style={{ marginTop: 8 }}>
                  {explanation ? (
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {preprocessMath(explanation)}
                    </ReactMarkdown>
                  ) : (
                    <Text>加载中...</Text>
                  )}
                  {evaluating && <Text type="secondary"> (正在生成...)</Text>}
                </div>
              </div>
              {suggestion && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>改进建议:</Text>
                  <div style={{ marginTop: 8 }}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {preprocessMath(suggestion)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              <Progress percent={isCorrect ? 100 : aiScore !== null ? aiScore * 10 : 0}
                status={isCorrect ? 'success' : 'exception'} format={(p) => `${p}%`} />
              <div style={{ marginTop: 16 }}>
                <div className="reference-answer">
                  <Text strong>参考答案:</Text>
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {preprocessMath(question.answer)}
                  </ReactMarkdown>
                </div>
              </div>
            </Card>
          </StarBorder>
        </motion.div>
      )}

      {allQuestions.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <Button disabled={!hasPrev} onClick={() => handleNavigate('prev')}>← 上一题</Button>
          <Button disabled={!hasNext} onClick={() => handleNavigate('next')}>下一题 →</Button>
        </div>
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

/** Wrap inline LaTeX math in $...$ for KaTeX rendering */
function preprocessMath(text: string): string {
  // Already has $ delimiters — leave as-is
  if (text.includes('$')) return text;
  // Wrap word^{content} (e.g. A^{-1}, AA^{-1}=I)
  let r = text.replace(/\b([\w]+(?:\^|\_)\{[^}]*\})/g, '$$$1$$');
  // Wrap word^word (e.g. A^T)
  r = r.replace(/\b([\w]+(?:\^|\_)[\w]+)/g, '$$$1$$');
  return r;
}
