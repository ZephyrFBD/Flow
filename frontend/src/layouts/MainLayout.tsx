import { Layout, Typography, theme } from 'antd';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { HomeOutlined, SettingOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

const { Header, Content } = Layout;
const { Text } = Typography;

const navItems = [
  { path: '/', label: '首页', icon: <HomeOutlined /> },
  { path: '/generate', label: '新建' },
  { path: '/settings', label: '设置', icon: <SettingOutlined /> },
];

export default function MainLayout() {
  const location = useLocation();
  const { isDark, toggle } = useTheme();
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Text strong style={{ fontSize: 18, color: token.colorText }}>
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
                  color: location.pathname === item.path ? token.colorPrimary : token.colorTextDescription,
                  fontWeight: location.pathname === item.path ? 600 : 400,
                }}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={toggle} style={{ cursor: 'pointer', color: token.colorTextDescription, fontSize: 18, lineHeight: 1 }}>
            {isDark ? <SunOutlined /> : <MoonOutlined />}
          </span>
          <Link to="/settings" style={{ color: token.colorTextDescription, lineHeight: 1 }}>
            <SettingOutlined style={{ fontSize: 18 }} />
          </Link>
        </div>
      </Header>
      <Content style={{ padding: 24, background: token.colorBgLayout }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
