import { useEffect, useState } from 'react';
import { Card, Button, Row, Col, Typography, Empty, Space, Statistic, Upload } from 'antd';
import { PlusOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listTrees, loadProject, deleteTree } from '../services/api';
import type { TreeListItem } from '../types';
import ProjectCard from '../components/ProjectCard';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import FadeIn from '../components/ui/FadeIn';

const { Title, Text } = Typography;

export default function HomePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TreeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrees = async () => {
    setLoading(true);
    try {
      const data = await listTrees();
      setItems(data);
    } catch {
      // OK
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrees(); }, []);

  const handleLoadFile = async (file: File) => {
    try {
      const tree = await loadProject(file);
      navigate(`/tree/${tree.tree_id}`);
    } catch { /* ignore */ }
    return false;
  };

  const handleDelete = async (treeId: string) => {
    try {
      await deleteTree(treeId);
      fetchTrees();
    } catch { /* ok */ }
  };

  const totalNodes = items.reduce((s, i) => s + i.node_count, 0);
  const totalCompleted = items.reduce((s, i) => s + i.completed_count, 0);

  return (
    <FadeIn>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Title level={2} style={{ marginBottom: 8 }}>Flow — AI 知识点梳理</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          从文本或 PDF 自动生成知识结构树，支持交互式学习和例题练习
        </Text>

        <Space size="large" style={{ marginBottom: 24 }}>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/generate')}>
            新建知识树
          </Button>
          <Upload accept=".knowtree" showUploadList={false} beforeUpload={handleLoadFile}>
            <Button size="large" icon={<FolderOpenOutlined />}>打开 .knowtree 文件</Button>
          </Upload>
        </Space>

        {items.length > 0 && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="项目总数" valueRender={() => <AnimatedCounter value={items.length} />} value={items.length} />
              </Card>
            </Col>
            <Col span={9}>
              <Card>
                <Statistic title="总知识点" valueRender={() => <AnimatedCounter value={totalNodes} />} value={totalNodes} />
              </Card>
            </Col>
            <Col span={9}>
              <Card>
                <Statistic
                  title="完成率"
                  valueRender={() => <AnimatedCounter value={totalNodes ? Math.round((totalCompleted / totalNodes) * 100) : 0} suffix="%" />}
                  value={totalNodes ? Math.round((totalCompleted / totalNodes) * 100) : 0}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>
        )}

        {items.length === 0 && !loading ? (
          <Card>
            <Empty description="暂无项目，创建一个新知识树开始学习">
              <Button type="primary" onClick={() => navigate('/generate')}>新建知识树</Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((item) => (
              <Col key={item.tree_id} span={8}>
                <ProjectCard
                  title={item.title}
                  nodeCount={item.node_count}
                  completedCount={item.completed_count}
                  version={item.version}
                  updatedAt={item.updated_at}
                  onClick={() => navigate(`/tree/${item.tree_id}`)}
                  onDelete={() => handleDelete(item.tree_id)}
                />
              </Col>
            ))}
          </Row>
        )}
      </div>
    </FadeIn>
  );
}
