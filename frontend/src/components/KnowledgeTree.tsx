import { Tree, Checkbox, Space, Tag, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { KnowledgeNode } from '../types';

const { Search } = Input;

interface Props {
  treeId: string;
  nodes: KnowledgeNode;
  selectedNode: string;
  onSelect: (id: string) => void;
  expandedKeys: string[];
  onExpand: (keys: string[]) => void;
  searchVal: string;
  onSearch: (val: string) => void;
  onCheck: (nodeId: string, checked: boolean) => void;
  onNodeClick: (nodeId: string) => void;
  onRename?: (nodeId: string, title: string) => void;
}

export default function KnowledgeTree({
  treeId, nodes, selectedNode, onSelect, expandedKeys, onExpand,
  searchVal, onSearch, onCheck, onNodeClick, onRename,
}: Props) {
  const treeData = [buildAntTreeData(nodes)];

  return (
    <div>
      <Search
        placeholder="搜索节点..."
        allowClear
        style={{ marginBottom: 12 }}
        value={searchVal}
        onChange={(e) => onSearch(e.target.value)}
      />
      <Tree
        showLine
        treeData={treeData}
        selectedKeys={selectedNode ? [selectedNode] : []}
        expandedKeys={expandedKeys}
        onExpand={(keys) => onExpand(keys as string[])}
        onSelect={(keys) => { if (keys.length > 0) onSelect(keys[0] as string); }}
        titleRender={(nodeData: any) => (
          <TreeNodeLabel
            node={nodeData}
            treeId={treeId}
            checked={nodeData.completed}
            onCheck={(checked: boolean) => onCheck(nodeData.key, checked)}
            searchVal={searchVal}
            onClick={() => onNodeClick(nodeData.key)}
          />
        )}
      />
    </div>
  );
}

function TreeNodeLabel({ node, checked, onCheck, searchVal, onClick }: any) {
  const isMatch = searchVal && node.title?.includes(searchVal);
  return (
    <Space
      size={4}
      style={{ cursor: 'pointer', fontWeight: isMatch ? 700 : 400 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        onChange={(e) => onCheck(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <span onClick={onClick} style={{ color: isMatch ? '#1677ff' : undefined }}>
        {node.title}
        {checked && <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>完成</Tag>}
      </span>
    </Space>
  );
}

function buildAntTreeData(node: KnowledgeNode): any {
  return {
    title: node.title,
    key: node.id,
    completed: node.completed,
    children: (node.children || []).map(buildAntTreeData),
  };
}
