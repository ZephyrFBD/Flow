import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Typography, Space, Tag, Spin, Empty, Progress, Select, Input, message } from 'antd';
import { getTree, updateNode, listTrees, getSaveUrl } from '../services/api';
import type { KnowledgeTreeFile, KnowledgeNode, TreeListItem } from '../types';
import KnowledgeTree from '../components/KnowledgeTree';

const { Title, Text } = Typography;

export default function TreePage() {
  const { treeId } = useParams<{ treeId: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<KnowledgeTreeFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [searchVal, setSearchVal] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [versions, setVersions] = useState<TreeListItem[]>([]);

  const loadTree = (tid: string) => {
    setLoading(true);
    getTree(tid).then((data) => {
      setTree(data);
      setExpandedKeys([data.nodes.id]);
      setSelectedNode('');
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!treeId) return;
    loadTree(treeId);
    listTrees().then((items) => setVersions(items));
  }, [treeId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
  if (!tree) return <Empty description="知识树未找到" />;

  const stats = countStats(tree.nodes);

  // Version family for the selector
  const familyIds = getVersionFamily(tree.tree_id, versions);
  const versionOptions = versions
    .filter((v) => familyIds.has(v.tree_id))
    .sort((a, b) => a.version - b.version);

  const handleCheck = async (nodeId: string, checked: boolean) => {
    if (!treeId) return;
    try {
      const updated = await updateNode(treeId, nodeId, { completed: checked });
      setTree(updated);
    } catch { /* ok */ }
  };

  const handleRename = async (nodeId: string, title: string) => {
    if (!treeId || !title.trim()) return;
    try {
      const updated = await updateNode(treeId, nodeId, { title: title.trim() });
      setTree(updated);
      message.success('已重命名');
    } catch { message.error('重命名失败'); }
  };

  const handleSave = () => {
    const a = document.createElement('a');
    a.href = getSaveUrl(tree.tree_id);
    a.download = '';
    a.click();
  };

  const found = selectedNode ? findNode(tree.nodes, selectedNode) : null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={3} style={{ margin: 0 }}>{tree.title}</Title>
          <Space size="small">
            {versionOptions.length > 1 ? (
              <Select
                value={tree.tree_id}
                onChange={(tid) => navigate(`/tree/${tid}`)}
                size="small"
                style={{ width: 100 }}
                options={versionOptions.map((v) => ({
                  value: v.tree_id,
                  label: `v${v.version}`,
                }))}
              />
            ) : (
              <Tag>v{tree.version}</Tag>
            )}
          </Space>
        </Space>
        <Space>
          <Button onClick={handleSave}>💾 保存</Button>
          <Button onClick={() => navigate(`/generate?refine=${treeId}&mode=derive`)}>🌱 衍生</Button>
          <Button onClick={() => navigate(`/manage/${treeId}`)}>🌿 管理</Button>
          <Button type="primary" onClick={() => navigate(`/generate?refine=${treeId}`)}>✏️ 用AI修改</Button>
        </Space>
      </div>

      <Progress
        percent={Math.round((stats.completed / stats.total) * 100)}
        size="small"
        style={{ marginBottom: 16 }}
      />

      <div style={{ display: 'flex', gap: 16 }}>
        <Card size="small" style={{ flex: 1, minWidth: 320 }}>
          <KnowledgeTree
            treeId={treeId!}
            nodes={tree.nodes}
            selectedNode={selectedNode}
            onSelect={setSelectedNode}
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            searchVal={searchVal}
            onSearch={setSearchVal}
            onCheck={handleCheck}
            onNodeClick={(nodeId) => navigate(`/node/${treeId}/${nodeId}`)}
            onRename={handleRename}
          />
        </Card>

        {/* Node details panel */}
        <Card size="small" style={{ width: 300 }}>
          {found ? (
            <div>
              <Title level={5}>{found.title}</Title>
              <Text>{found.description || '暂无描述'}</Text>
              {found.keywords && found.keywords.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {found.keywords.map((kw) => <Tag key={kw}>{kw}</Tag>)}
                </div>
              )}
              <Space style={{ marginTop: 16 }}>
                <Button type="primary" size="small" onClick={() => navigate(`/node/${treeId}/${selectedNode}`)}>
                  📖 查看详解
                </Button>
              </Space>
            </div>
          ) : (
            <Empty description="选择一个节点查看详情" />
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Utils ---

function findNode(node: KnowledgeNode, id: string): KnowledgeNode | null {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function countStats(node: KnowledgeNode): { total: number; completed: number } {
  let total = 1;
  let completed = node.completed ? 1 : 0;
  for (const child of node.children || []) {
    const s = countStats(child);
    total += s.total;
    completed += s.completed;
  }
  return { total, completed };
}

function collectKeys(node: KnowledgeNode): string[] {
  return [node.id, ...(node.children || []).flatMap(collectKeys)];
}

function getVersionFamily(treeId: string, versions: TreeListItem[]): Set<string> {
  const map = new Map(versions.map((v) => [v.tree_id, v]));
  const family = new Set<string>();
  let current = map.get(treeId);
  while (current) {
    family.add(current.tree_id);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }
  const walkChildren = (id: string) => {
    for (const v of versions) {
      if (v.parent_id === id && !family.has(v.tree_id)) {
        family.add(v.tree_id);
        walkChildren(v.tree_id);
      }
    }
  };
  const root = [...family][family.size - 1];
  if (root) walkChildren(root);
  return family;
}
