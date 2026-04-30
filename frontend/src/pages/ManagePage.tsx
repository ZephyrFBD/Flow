import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Button, Tag, List, Space, Skeleton, Empty, Input, message, Popconfirm } from 'antd';
import { getTree, updateNode, deleteNode, addNode, listTrees } from '../services/api';
import type { KnowledgeTreeFile, KnowledgeNode, TreeListItem } from '../types';
import VersionGraph from '../components/VersionGraph';
import GradientText from '../components/GradientText';
import StarBorder from '../components/StarBorder';

const { Text } = Typography;

export default function ManagePage() {
  const { treeId } = useParams<{ treeId: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<KnowledgeTreeFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<KnowledgeNode | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [addingTitle, setAddingTitle] = useState('');
  const [allTrees, setAllTrees] = useState<TreeListItem[]>([]);

  useEffect(() => {
    if (!treeId) return;
    setLoading(true);
    Promise.all([getTree(treeId), listTrees()])
      .then(([data, items]) => { setTree(data); setAllTrees(items); setLoading(false); })
      .catch(() => setLoading(false));
  }, [treeId]);

  if (loading) return <Skeleton active style={{ padding: 48 }} />;
  if (!tree) return <Empty description="项目未找到" />;

  const handleSelectNode = (node: KnowledgeNode) => {
    setEditingNode(node);
    setEditTitle(node.title);
    setEditDesc(node.description);
  };

  const handleSaveNode = async () => {
    if (!treeId || !editingNode) return;
    try {
      const updated = await updateNode(treeId, editingNode.id, { title: editTitle, description: editDesc });
      setTree(updated);
      setEditingNode({ ...editingNode, title: editTitle, description: editDesc });
      message.success('已保存');
    } catch { message.error('保存失败'); }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!treeId) return;
    try {
      const updated = await deleteNode(treeId, nodeId);
      setTree(updated);
      setEditingNode(null);
      message.success('已删除');
    } catch { message.error('删除失败'); }
  };

  const handleAddNode = async () => {
    if (!treeId || !addingTitle.trim()) return;
    try {
      const parentId = editingNode?.id || tree.nodes.id;
      const updated = await addNode(treeId, addingTitle.trim(), parentId);
      setTree(updated);
      setAddingTitle('');
      message.success('节点已添加');
    } catch { message.error('添加失败'); }
  };

  const flatNodes = flattenTree(tree.nodes);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Button type="link" onClick={() => navigate(`/tree/${treeId}`)} style={{ marginBottom: 16 }}>← 返回知识树</Button>
      <GradientText colors={['#5227FF', '#FF9FFC', '#B497CF']} animationSpeed={6}>
        <span style={{ fontSize: 24, fontWeight: 700 }}>🌿 管理 · {tree.title}</span>
      </GradientText>

      <VersionGraph currentTreeId={treeId!} allTrees={allTrees} onNavigate={(tid) => navigate(`/manage/${tid}`)} />

      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <StarBorder color="#B497CF" speed="12s" thickness={1} as="div" style={{ flex: 1 }}>
          <Card title="节点列表" size="small">
          <List
            size="small"
            dataSource={flatNodes}
            renderItem={(node) => (
              <List.Item
                onClick={() => handleSelectNode(node)}
                style={{ cursor: 'pointer', background: editingNode?.id === node.id ? 'var(--selected-bg, #e6f4ff)' : undefined, padding: '4px 12px' }}
              >
                <Space>
                  <Text style={{ fontSize: 12, color: 'var(--text-secondary, #999)' }}>{node.id}</Text>
                  <Text delete={!node.title}>{node.title || '(未命名)'}</Text>
                  {node.completed && <Tag color="green" style={{ fontSize: 10 }}>完成</Tag>}
                </Space>
              </List.Item>
            )}
          />
        </Card>
        </StarBorder>

        <StarBorder color="#FF9FFC" speed="12s" thickness={1} as="div">
          <Card title="编辑节点" size="small" style={{ width: 400 }}
          extra={editingNode && <Popconfirm title="确认删除?" onConfirm={() => handleDeleteNode(editingNode.id)}><Button danger size="small">删除</Button></Popconfirm>}
        >
          {editingNode ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div><Text strong>标题</Text><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
              <div><Text strong>描述</Text><Input.TextArea rows={4} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
              {editingNode.keywords?.length > 0 && (
                <div><Text strong>关键词: </Text>{editingNode.keywords.map((kw) => <Tag key={kw}>{kw}</Tag>)}</div>
              )}
              <Button type="primary" onClick={handleSaveNode}>💾 保存修改</Button>
              <div style={{ borderTop: '1px solid var(--border-color, #f0f0f0)', paddingTop: 12, marginTop: 12 }}>
                <Text strong>添加子节点</Text>
                <Space style={{ marginTop: 8 }}>
                  <Input placeholder="节点标题" value={addingTitle} onChange={(e) => setAddingTitle(e.target.value)} />
                  <Button onClick={handleAddNode} disabled={!addingTitle.trim()}>添加</Button>
                </Space>
              </div>
            </Space>
          ) : <Text type="secondary">选择一个节点进行编辑</Text>}
          </Card>
        </StarBorder>
      </div>

      {tree.prompt_history.length > 0 && (
        <StarBorder color="#B497CF" speed="12s" thickness={1} as="div">
          <Card title="Prompt 历史" size="small" style={{ marginTop: 16 }}>
          {tree.prompt_history.map((record, idx) => (
            <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color, #f5f5f5)' }}>
              <Space>
                <Tag color={record.mode === 'generate' ? 'blue' : 'orange'}>{record.mode === 'generate' ? '生成' : '精炼'}</Tag>
                <Text type="secondary">{record.timestamp}</Text>
              </Space>
              {record.prompt_text && <div style={{ marginTop: 4 }}><Text>{record.prompt_text}</Text></div>}
            </div>
          ))}
          </Card>
        </StarBorder>
      )}
    </div>
  );
}

function flattenTree(node: KnowledgeNode, depth = 0): (KnowledgeNode & { _depth: number })[] {
  return [{ ...node, _depth: depth }, ...(node.children || []).flatMap((c) => flattenTree(c, depth + 1))];
}
