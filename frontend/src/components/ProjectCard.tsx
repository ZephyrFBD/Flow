import { Card, Typography, Space, Tag, Progress, Popconfirm } from 'antd';
import { RightCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import SpotlightCard from './ui/SpotlightCard';

const { Text } = Typography;

interface Props {
  title: string;
  nodeCount: number;
  completedCount: number;
  version: number;
  updatedAt: string;
  onClick: () => void;
  onDelete?: () => void;
}

export default function ProjectCard({ title, nodeCount, completedCount, version, updatedAt, onClick, onDelete }: Props) {
  const pct = nodeCount ? Math.round((completedCount / nodeCount) * 100) : 0;
  return (
    <SpotlightCard onClick={onClick}>
      <Card
        style={{ background: 'transparent' }}
        actions={[
          <RightCircleOutlined key="go" />,
          onDelete && (
            <Popconfirm key="delete" title="确定删除?" onConfirm={onDelete}>
              <DeleteOutlined onClick={(e) => e.stopPropagation()} />
            </Popconfirm>
          ),
        ].filter(Boolean)}
      >
        <Card.Meta
          title={
            <Space>
              {title}
              <Tag style={{ fontSize: 10 }}>v{version}</Tag>
            </Space>
          }
          description={
            <div>
              <Text type="secondary">{nodeCount} 个知识点</Text>
              <br />
              <Text type="secondary">完成 {completedCount}/{nodeCount}</Text>
              <Progress percent={pct} size="small" showInfo={false} style={{ marginTop: 4 }} />
            </div>
          }
        />
      </Card>
    </SpotlightCard>
  );
}
