import { useState } from 'react';
import { Space, Checkbox, Select, Radio, Input, Button, Card, Typography } from 'antd';
import type { QuestionConfig } from '../types';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  onGenerate: (config: QuestionConfig) => void;
  loading?: boolean;
}

export default function QuestionForm({ onGenerate, loading }: Props) {
  const [types, setTypes] = useState<string[]>(['choice', 'essay']);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [extra, setExtra] = useState('');

  const handleGenerate = () => {
    onGenerate({
      types: types as QuestionConfig['types'],
      count,
      difficulty,
      extra_requirements: extra || undefined,
    });
  };

  return (
    <Card title="📝 生成例题" style={{ marginBottom: 16 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <Text>题型:</Text>
          <Checkbox checked={types.includes('choice')} onChange={(e) => {
            setTypes(e.target.checked ? [...types, 'choice'] : types.filter((t) => t !== 'choice'));
          }}>选择题</Checkbox>
          <Checkbox checked={types.includes('essay')} onChange={(e) => {
            setTypes(e.target.checked ? [...types, 'essay'] : types.filter((t) => t !== 'essay'));
          }}>解答题</Checkbox>
        </Space>
        <Space>
          <Text>数量:</Text>
          <Select value={count} onChange={setCount} style={{ width: 80 }}
            options={[5, 10, 15, 20].map((n) => ({ value: n, label: `${n}题` }))} />
          <Text>难度:</Text>
          <Radio.Group value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <Radio value="easy">简单</Radio>
            <Radio value="medium">中等</Radio>
            <Radio value="hard">困难</Radio>
          </Radio.Group>
        </Space>
        <TextArea
          placeholder="额外要求（可选）：侧重于实际应用场景..."
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
        />
        <Button type="primary" onClick={handleGenerate} loading={loading}>
          🎯 生成并开始答题
        </Button>
      </Space>
    </Card>
  );
}
