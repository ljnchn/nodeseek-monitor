import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { PlusIcon, EditIcon, DeleteIcon } from '../components/icons';

interface Config {
  id: number;
  username: string;
  bot_token?: string;
  chat_id: string;
  stop_push: number;
  only_title: number;
}

interface Subscription {
  id: number;
  keyword1: string;
  keyword2?: string;
  keyword3?: string;
  creator?: string;
  category?: string;
  created_at: string;
}

interface Post {
  id: number;
  post_id: number;
  title: string;
  memo: string;
  category: string;
  creator: string;
  push_status: number;
  pub_date: string;
  push_date?: string;
}

export function Dashboard() {
  const [config, setConfig] = useState<Config | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [botToken, setBotToken] = useState('');
  const [newSub, setNewSub] = useState({
    keyword1: '',
    keyword2: '',
    keyword3: '',
    creator: '',
    category: ''
  });
  useState<Subscription | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [configRes, subsRes, postsRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/subscriptions'),
        fetch('/api/posts?limit=10')
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
        setBotToken(configData.bot_token || '');
      }

      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscriptions(subsData);
      }

      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<Config>) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedConfig = await response.json();
        setConfig(updatedConfig);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const setBotWebhook = async () => {
    if (!botToken) return;

    try {
      await updateConfig({ bot_token: botToken });
      
      const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
      const response = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });

      if (response.ok) {
        alert('Webhook 设置成功！');
      } else {
        alert('Webhook 设置失败');
      }
    } catch (error) {
      console.error('Failed to set webhook:', error);
      alert('Webhook 设置失败');
    }
  };

  const addSubscription = async () => {
    if (!newSub.keyword1) return;

    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword1: newSub.keyword1,
          keyword2: newSub.keyword2 || undefined,
          keyword3: newSub.keyword3 || undefined,
          creator: newSub.creator || undefined,
          category: newSub.category || undefined,
        }),
      });

      if (response.ok) {
        setNewSub({ keyword1: '', keyword2: '', keyword3: '', creator: '', category: '' });
        loadData();
      }
    } catch (error) {
      console.error('Failed to add subscription:', error);
    }
  };

  const deleteSubscription = async (id: number) => {
    if (!confirm('您确定要删除这个订阅吗？')) return;

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete subscription:', error);
    }
  };

  const processRSS = async () => {
    try {
      const response = await fetch('/api/process-rss', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        alert(`RSS 处理完成：${result.processed} 篇文章，${result.matched} 篇匹配`);
        loadData();
      } else {
        alert('RSS 处理失败');
      }
    } catch (error) {
      console.error('Failed to process RSS:', error);
      alert('RSS 处理失败');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">NodeSeek 监控仪表板</h1>

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle>基础设置</CardTitle>
          <CardDescription>配置 Telegram 机器人和监控设置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Telegram 机器人令牌</Label>
              <div className="flex gap-2">
                <Input
                  id="botToken"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="输入您的机器人令牌"
                />
                <Button onClick={setBotWebhook}>设置 Webhook</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                状态：{config?.bot_token ? '已配置' : '未配置'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatId">Telegram 聊天 ID</Label>
              <Input
                id="chatId"
                value={config?.chat_id || ''}
                onChange={(e) => updateConfig({ chat_id: e.target.value })}
                placeholder="您的聊天 ID"
              />
              <p className="text-sm text-muted-foreground">
                状态：{config?.chat_id ? '已配置' : '未配置'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={config?.only_title === 1}
                onCheckedChange={(checked) => updateConfig({ only_title: checked ? 1 : 0 })}
              />
              <Label>仅匹配标题</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={config?.stop_push === 1}
                onCheckedChange={(checked) => updateConfig({ stop_push: checked ? 1 : 0 })}
              />
              <Label>停止推送通知</Label>
            </div>
          </div>

          <Button onClick={processRSS} className="w-full">
            立即处理 RSS
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle>订阅管理</CardTitle>
          <CardDescription>管理您的关键词订阅</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new subscription */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="关键词 1（必填）"
              value={newSub.keyword1}
              onChange={(e) => setNewSub({ ...newSub, keyword1: e.target.value })}
            />
            <Input
              placeholder="关键词 2（可选）"
              value={newSub.keyword2}
              onChange={(e) => setNewSub({ ...newSub, keyword2: e.target.value })}
            />
            <Input
              placeholder="关键词 3（可选）"
              value={newSub.keyword3}
              onChange={(e) => setNewSub({ ...newSub, keyword3: e.target.value })}
            />
            <Input
              placeholder="作者筛选（可选）"
              value={newSub.creator}
              onChange={(e) => setNewSub({ ...newSub, creator: e.target.value })}
            />
            <Input
              placeholder="分类筛选（可选）"
              value={newSub.category}
              onChange={(e) => setNewSub({ ...newSub, category: e.target.value })}
            />
            <Button onClick={addSubscription} className="flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              添加订阅
            </Button>
          </div>

          {/* Subscription list */}
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">
                    {[sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean).join(' + ')}
                  </div>
                  {(sub.creator || sub.category) && (
                    <div className="text-sm text-muted-foreground">
                      {sub.creator && `作者：${sub.creator}`}
                      {sub.creator && sub.category && ' | '}
                      {sub.category && `分类：${sub.category}`}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    创建时间：{new Date(sub.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <EditIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSubscription(sub.id)}
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Posts */}
      <Card>
        <CardHeader>
          <CardTitle>最新文章</CardTitle>
          <CardDescription>最新文章及其推送状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="p-3 border rounded">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{post.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {post.memo.substring(0, 100)}...
                    </p>
                    <div className="text-xs text-muted-foreground mt-2">
                      作者：{post.creator} | 分类：{post.category} | 
                      发布时间：{new Date(post.pub_date).toLocaleString()}
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      post.push_status === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                      post.push_status === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                      'bg-secondary text-secondary-foreground'
                    }`}>
                      {post.push_status === 0 ? '未推送' :
                       post.push_status === 1 ? '已推送' : '无需推送'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}