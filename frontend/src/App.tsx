import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AppProvider } from './contexts/AppContext';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import GeneratePage from './pages/GeneratePage';
import TreePage from './pages/TreePage';
import NodeDetailPage from './pages/NodeDetailPage';
import PracticePage from './pages/PracticePage';
import ManagePage from './pages/ManagePage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
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
    </ConfigProvider>
  );
}
