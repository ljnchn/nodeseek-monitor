import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface InitPageProps {
  onInit: () => void;
}

export function InitPage({ onInit }: InitPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          chat_id: chatId,
          stop_push: 0,
          only_title: 0,
        }),
      });

      if (response.ok) {
        onInit();
      } else {
        const data = await response.json();
        setError(data.error || '初始化失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>系统初始化</CardTitle>
          <CardDescription>
            请设置管理员账户和基础配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatId">Telegram 聊天 ID</Label>
              <Input
                id="chatId"
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="您的 Telegram 聊天 ID"
                required
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '初始化中...' : '初始化系统'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}