import { Layout, Typography } from 'antd';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { HomeOutlined, SettingOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;
const { Text } = Typography;

const navItems = [
  { path: '/', label: '首页', icon: <HomeOutlined /> },
  { path: '/generate', label: '新建' },
  { path: '/settings', label: '设置', icon: <SettingOutlined /> },
];

export default function MainLayout() {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Text strong style={{ fontSize: 18 }}>
              Flow
            </Text>
          </Link>
          <nav style={{ display: 'flex', gap: 16 }}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  textDecoration: 'none',
                  color: location.pathname === item.path ? '#1677ff' : '#666',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                }}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link to="/settings" style={{ color: '#666' }}>
          <SettingOutlined style={{ fontSize: 18 }} />
        </Link>
      </Header>
      <Content style={{ padding: 24, background: '#f5f5f5' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
