import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AppProvider } from './contexts/AppContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import GeneratePage from './pages/GeneratePage';
import TreePage from './pages/TreePage';
import NodeDetailPage from './pages/NodeDetailPage';
import PracticePage from './pages/PracticePage';
import ManagePage from './pages/ManagePage';
import SettingsPage from './pages/SettingsPage';
import Noise from './components/Noise';

function GlobalEffects() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Noise patternAlpha={6} patternSize={200} patternRefreshInterval={4} />
    </div>
  );
}

function ThemedApp() {
  const { isDark } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <div style={{ position: 'relative', minHeight: '100vh' }}>
        <GlobalEffects />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AppProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/generate" element={<GeneratePage />} />
                  <Route path="/tree/:treeId" element={<TreePage />} />
                  <Route path="/node/:treeId/:nodeId" element={<NodeDetailPage />} />
                  <Route path="/practice/:questionId" element={<PracticePage />} />
                  <Route path="/manage/:treeId" element={<ManagePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AppProvider>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
