import { useEffect, useState } from 'react';
import { Card, Typography, Input, Button, Select, Space, message, Spin, Alert } from 'antd';
import { getConfig, updateProvider, setActiveProvider, getProviders } from '../services/api';
import type { LLMConfig, LLMProviderStatus } from '../types';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [statuses, setStatuses] = useState<Record<string, LLMProviderStatus> | null>(null);
  const [loading, setLoading] = useState(true);

  // OpenAI
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiUrl, setOpenaiUrl] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');

  // Claude
  const [claudeKey, setClaudeKey] = useState('');
  const [claudeUrl, setClaudeUrl] = useState('');
  const [claudeModel, setClaudeModel] = useState('');

  // Ollama
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');

  // Test status per provider
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, 'success' | 'fail' | null>>({});

  useEffect(() => {
    Promise.all([getConfig(), getProviders()]).then(([cfg, st]) => {
      setConfig(cfg);
      setStatuses(st);
      setOpenaiUrl(cfg.providers.openai.base_url);
      setOpenaiModel(cfg.providers.openai.model);
      setClaudeUrl(cfg.providers.claude.base_url);
      setClaudeModel(cfg.providers.claude.model);
      setOllamaUrl(cfg.providers.ollama.base_url);
      setOllamaModel(cfg.providers.ollama.model);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (provider: string, data: any) => {
    try {
      await updateProvider(provider, data);
      message.success(`${provider} 配置已保存`);
    } catch { message.error('保存失败'); }
  };

  const handleSwitchProvider = async (provider: string) => {
    try {
      await setActiveProvider(provider);
      setConfig((prev) => prev ? { ...prev, active_provider: provider } : prev);
      message.success(`已切换到 ${provider}`);
    } catch { message.error('切换失败'); }
  };

  const handleTestConnection = async (provider: string) => {
    setTesting((prev) => ({ ...prev, [provider]: true }));
    setTestResult((prev) => ({ ...prev, [provider]: null }));
    try {
      const st = await getProviders();
      const ok = st[provider]?.configured;
      setTestResult((prev) => ({ ...prev, [provider]: ok ? 'success' : 'fail' }));
      if (ok) message.success(`${provider} 连接成功`);
      else message.error(`${provider} 连接失败`);
    } catch {
      setTestResult((prev) => ({ ...prev, [provider]: 'fail' }));
      message.error(`${provider} 连接失败`);
    } finally {
      setTesting((prev) => ({ ...prev, [provider]: false }));
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Title level={3}>⚙️ 设置</Title>

      <Card title="默认模型" size="small" style={{ marginBottom: 16 }}>
        <Select value={config?.active_provider} onChange={handleSwitchProvider} style={{ width: 200 }}
          options={[
            { value: 'openai', label: 'OpenAI' },
            { value: 'claude', label: 'Claude' },
            { value: 'ollama', label: 'Ollama' },
          ]}
        />
      </Card>

      {/* OpenAI */}
      <Card title="OpenAI" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>API Key</Text>
            <Input.Password placeholder="sk-..." value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
          </div>
          <div>
            <Text>Base URL</Text>
            <Input value={openaiUrl} onChange={(e) => setOpenaiUrl(e.target.value)} />
          </div>
          <div>
            <Text>Model</Text>
            <Input value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} />
          </div>
          <Space>
            <Button onClick={() => handleSave('openai', { api_key: openaiKey, base_url: openaiUrl, model: openaiModel })}>
              保存 OpenAI 配置
            </Button>
            <Button onClick={() => handleTestConnection('openai')} loading={testing.openai}>
              🔗 测试连接
            </Button>
            {testResult.openai === 'success' && <Alert type="success" message="✅ 连接成功" showIcon style={{ margin: 0 }} />}
            {testResult.openai === 'fail' && <Alert type="error" message="❌ 连接失败" showIcon style={{ margin: 0 }} />}
          </Space>
        </Space>
      </Card>

      {/* Claude */}
      <Card title="Claude (Anthropic)" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>API Key</Text>
            <Input.Password placeholder="sk-ant-..." value={claudeKey} onChange={(e) => setClaudeKey(e.target.value)} />
          </div>
          <div>
            <Text>Base URL</Text>
            <Input value={claudeUrl} onChange={(e) => setClaudeUrl(e.target.value)} placeholder="https://api.anthropic.com/v1" />
          </div>
          <div>
            <Text>Model</Text>
            <Input value={claudeModel} onChange={(e) => setClaudeModel(e.target.value)} />
          </div>
          <Space>
            <Button onClick={() => handleSave('claude', { api_key: claudeKey, base_url: claudeUrl, model: claudeModel })}>
              保存 Claude 配置
            </Button>
            <Button onClick={() => handleTestConnection('claude')} loading={testing.claude}>
              🔗 测试连接
            </Button>
            {testResult.claude === 'success' && <Alert type="success" message="✅ 连接成功" showIcon style={{ margin: 0 }} />}
            {testResult.claude === 'fail' && <Alert type="error" message="❌ 连接失败" showIcon style={{ margin: 0 }} />}
          </Space>
        </Space>
      </Card>

      {/* Ollama */}
      <Card title="Ollama (本地)" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>API URL</Text>
            <Input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} />
          </div>
          <div>
            <Text>Model</Text>
            <Input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} />
          </div>
          <Space>
            <Button onClick={() => handleSave('ollama', { base_url: ollamaUrl, model: ollamaModel })}>
              保存 Ollama 配置
            </Button>
            <Button onClick={() => handleTestConnection('ollama')} loading={testing.ollama}>
              🔗 测试连接
            </Button>
            {testResult.ollama === 'success' && <Alert type="success" message="✅ 连接成功" showIcon style={{ margin: 0 }} />}
            {testResult.ollama === 'fail' && <Alert type="error" message="❌ 连接失败" showIcon style={{ margin: 0 }} />}
          </Space>
        </Space>
      </Card>
    </div>
  );
}
