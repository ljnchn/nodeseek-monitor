import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface InitPageProps {
  onInit: () => void;
}

export function InitPage({ onInit }: InitPageProps) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botInfo, setBotInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStepOne = async (e: React.FormEvent) => {
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
          stop_push: 0,
          only_title: 0,
        }),
      });

      if (response.ok) {
        setStep(2);
      } else {
        const data = await response.json();
        setError(data.error || '保存失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateBotToken = async () => {
    if (!botToken.trim()) {
      setError('请输入 Bot Token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/validate-bot-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botToken }),
      });

      const data = await response.json();
      
      if (response.ok && data.valid) {
        setBotInfo(data.botInfo);
        setError('');
      } else {
        setError(data.error || 'Bot Token 验证失败');
        setBotInfo(null);
      }
    } catch (err) {
      setError('网络错误');
      setBotInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBindUser = async () => {
    setLoading(true);
    setError('');

    try {
      // 保存 bot token 到配置
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          bot_token: botToken,
          stop_push: 0,
          only_title: 0,
        }),
      });

      if (response.ok) {
        onInit();
      } else {
        const data = await response.json();
        setError(data.error || '保存失败');
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipBotSetup = async () => {
    setLoading(true);
    setError('');

    try {
      // 不保存 bot token，直接完成初始化
      onInit();
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
          <CardTitle>系统初始化 - 第{step}步</CardTitle>
          <CardDescription>
            {step === 1 ? '请设置管理员账户' : '配置 Telegram 机器人（可选）'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <form onSubmit={handleStepOne} className="space-y-4">
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
              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '保存中...' : '下一步'}
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="botToken">Telegram Bot Token</Label>
                <Input
                  id="botToken"
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="输入您的 Bot Token"
                />
                <div className="text-sm text-gray-600">
                  通过 @BotFather 创建机器人并获取 Token
                </div>
              </div>
              
              <Button 
                onClick={handleValidateBotToken} 
                className="w-full" 
                disabled={loading || !botToken.trim()}
                variant="outline"
              >
                {loading ? '验证中...' : '验证 Bot Token'}
              </Button>

              {botInfo && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-green-800 text-sm">
                    ✅ Bot Token 验证成功！
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    机器人名称: {botInfo.first_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    用户名: @{botInfo.username}
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <div className="space-y-2">
                {botInfo && (
                  <Button 
                    onClick={handleBindUser} 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? '保存中...' : '完成初始化'}
                  </Button>
                )}
                
                <Button 
                  onClick={handleSkipBotSetup} 
                  className="w-full" 
                  variant="outline"
                  disabled={loading}
                >
                  {loading ? '跳过中...' : '跳过，稍后在面板设置'}
                </Button>
              </div>

              <div className="text-xs text-gray-500 mt-2">
                💡 提示：跳过后可以在管理面板中配置机器人
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}