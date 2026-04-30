import { Space, Button, Typography } from 'antd';
import type { TreeListItem } from '../types';

const { Text } = Typography;

interface Props {
  currentTreeId: string;
  allTrees: TreeListItem[];
  onNavigate: (treeId: string) => void;
}

export default function VersionGraph({ currentTreeId, allTrees, onNavigate }: Props) {
  const chain = buildVersionChain(currentTreeId, allTrees);
  if (chain.length <= 1) return null;

  return (
    <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 6 }}>
      <Space>
        <Text type="secondary" style={{ fontSize: 12 }}>版本链:</Text>
        {chain.map((v, i) => (
          <Space key={v.tree_id}>
            {i > 0 && <Text type="secondary">→</Text>}
            <Button
              type={v.tree_id === currentTreeId ? 'primary' : 'default'}
              size="small"
              onClick={() => onNavigate(v.tree_id)}
            >
              v{v.version}
            </Button>
          </Space>
        ))}
      </Space>
    </div>
  );
}

function buildVersionChain(treeId: string, allTrees: TreeListItem[]): TreeListItem[] {
  const map = new Map(allTrees.map((t) => [t.tree_id, t]));
  const chain: TreeListItem[] = [];
  let current = map.get(treeId);
  while (current) {
    chain.unshift(current);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }
  const walkChildren = (id: string) => {
    for (const t of allTrees) {
      if (t.parent_id === id && !chain.find((c) => c.tree_id === t.tree_id)) {
        chain.push(t);
        walkChildren(t.tree_id);
      }
    }
  };
  walkChildren(treeId);
  return chain;
}
