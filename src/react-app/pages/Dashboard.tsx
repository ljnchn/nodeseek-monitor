import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { PlusIcon, EditIcon, DeleteIcon } from '../components/icons';
import { AuthUtils } from '../lib/auth';

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

interface Stats {
  config: {
    stop_push: number;
    only_title: number;
    has_bot_token: boolean;
    has_chat_id: boolean;
  };
  subscriptions: {
    total: number;
    latest: string | null;
  };
  posts: {
    total: number;
    matched: number;
    pushed: number;
    today: number;
  };
}

type Tab = 'settings' | 'subscriptions' | 'posts' | 'stats';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [config, setConfig] = useState<Config | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [botToken, setBotToken] = useState('');
  const [bindingStatus, setBindingStatus] = useState<{
    bound: boolean;
    chat_id?: string;
    user_info?: any;
    message: string;
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [newSub, setNewSub] = useState({
    keyword1: '',
    keyword2: '',
    keyword3: '',
    creator: '',
    category: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // 检查绑定状态
    checkBindingStatus();
  }, [config]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isPolling) {
      intervalId = setInterval(checkBindingStatus, 2000); // 每2秒检查一次
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPolling]);

  const loadData = async () => {
    try {
      const [configRes, subsRes, postsRes, statsRes] = await Promise.all([
        AuthUtils.authFetch('/api/config'),
        AuthUtils.authFetch('/api/subscriptions'),
        AuthUtils.authFetch('/api/posts?limit=20'),
        AuthUtils.authFetch('/api/stats')
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

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: Partial<Config>) => {
    try {
      const response = await AuthUtils.authFetch('/api/config', {
        method: 'POST',
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedConfig = await response.json();
        setConfig(updatedConfig);
        // 重新加载统计数据
        const statsRes = await AuthUtils.authFetch('/api/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };



  const addSubscription = async () => {
    if (!newSub.keyword1) return;

    try {
      const response = await AuthUtils.authFetch('/api/subscriptions', {
        method: 'POST',
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
      const response = await AuthUtils.authFetch(`/api/subscriptions/${id}`, {
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
      const response = await AuthUtils.authFetch('/api/process-rss', {
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

  const checkBindingStatus = async () => {
    try {
      const response = await AuthUtils.authFetch('/api/telegram/binding-status');
      if (response.ok) {
        const status = await response.json();
        setBindingStatus(status);
        
        // 如果绑定成功，停止轮询
        if (status.bound && isPolling) {
          setIsPolling(false);
        }
      }
    } catch (error) {
      console.error('Failed to check binding status:', error);
    }
  };

  const startBinding = async () => {
    if (!botToken) {
      alert('请先设置 Bot Token');
      return;
    }

    try {
      // 先保存bot token
      await updateConfig({ bot_token: botToken });
      
      // 设置webhook
      const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
      const response = await AuthUtils.authFetch('/api/telegram/set-webhook', {
        method: 'POST',
        body: JSON.stringify({ 
          webhookUrl,
          botToken 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert('Webhook 设置成功！现在请向机器人发送 /bind 命令来绑定用户。');
          setIsPolling(true); // 开始轮询绑定状态
        } else {
          alert('Webhook 设置失败: ' + result.message);
        }
      } else {
        const errorData = await response.json();
        alert('Webhook 设置失败: ' + (errorData.error || '未知错误'));
      }
    } catch (error) {
      console.error('Failed to start binding:', error);
      alert('设置失败: ' + (error instanceof Error ? error.message : '网络错误'));
    }
  };

  const renderBotStatus = () => {
    if (!config || !stats) return null;
    
    const botConfigured = stats.config.has_bot_token;
    const chatConfigured = stats.config.has_chat_id;
    const systemReady = botConfigured && chatConfigured;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${systemReady ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            系统状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${botConfigured ? 'text-green-600' : 'text-red-600'}`}>
                {botConfigured ? '✓' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground">Bot 配置</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${chatConfigured ? 'text-green-600' : 'text-red-600'}`}>
                {chatConfigured ? '✓' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground">Chat ID</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.subscriptions.total}</div>
              <div className="text-sm text-muted-foreground">订阅数量</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.posts.today}</div>
              <div className="text-sm text-muted-foreground">今日文章</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'settings':
        return (
          <div className="space-y-6">
            {/* Bot 配置卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>Telegram 机器人配置</CardTitle>
                <CardDescription>配置 Telegram 机器人以接收监控通知</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="botToken">机器人令牌 (Bot Token)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="botToken"
                      type="password"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="输入您的机器人令牌"
                      className="flex-1"
                    />
                    <Button onClick={startBinding} disabled={!botToken || isPolling}>
                      {isPolling ? '等待绑定...' : '开始绑定'}
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    状态：
                    <span className={`ml-1 font-medium ${config?.bot_token ? 'text-green-600' : 'text-red-600'}`}>
                      {config?.bot_token ? '✓ 已配置' : '✗ 未配置'}
                    </span>
                  </div>
                </div>

                {/* 绑定状态 */}
                {bindingStatus && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${bindingStatus.bound ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                      <span className="font-medium">绑定状态</span>
                    </div>
                    {bindingStatus.bound ? (
                      <div className="space-y-1">
                        <p className="text-green-600 font-medium">✅ 用户已绑定</p>
                        {bindingStatus.user_info && (
                          <div className="text-sm text-muted-foreground">
                            <p>用户: {bindingStatus.user_info.first_name} {bindingStatus.user_info.last_name || ''}</p>
                            <p>用户名: {bindingStatus.user_info.username ? '@' + bindingStatus.user_info.username : '无'}</p>
                            <p>Chat ID: {bindingStatus.chat_id}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-yellow-600 font-medium">⏳ 等待用户绑定</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>请向机器人发送以下命令完成绑定：</p>
                          <code className="px-2 py-1 bg-gray-100 rounded text-blue-600 font-mono">/bind</code>
                        </div>
                        {isPolling && (
                          <div className="flex items-center gap-2 text-blue-600">
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm">正在监听绑定状态...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 监控设置卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>监控设置</CardTitle>
                <CardDescription>配置文章匹配和推送行为</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config?.only_title === 1}
                      onCheckedChange={(checked) => updateConfig({ only_title: checked ? 1 : 0 })}
                    />
                    <div>
                      <Label>仅匹配标题</Label>
                      <p className="text-xs text-muted-foreground">关闭时会同时匹配标题和内容</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={config?.stop_push === 1}
                      onCheckedChange={(checked) => updateConfig({ stop_push: checked ? 1 : 0 })}
                    />
                    <div>
                      <Label>停止推送通知</Label>
                      <p className="text-xs text-muted-foreground">暂时停止向 Telegram 发送通知</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 操作卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>手动操作</CardTitle>
                <CardDescription>立即执行监控任务</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={processRSS} className="w-full" size="lg">
                  🔄 立即处理 RSS 并推送
                </Button>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  手动触发一次完整的 RSS 抓取和匹配流程
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'subscriptions':
        return (
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
        );

      case 'posts':
        return (
          <Card>
            <CardHeader>
              <CardTitle>文章列表</CardTitle>
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
        );

      case 'stats':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>系统配置统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      {stats?.config.has_bot_token ? '已配置' : '未配置'}
                    </div>
                    <div className="text-sm text-muted-foreground">Bot Token</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {stats?.config.has_chat_id ? '已配置' : '未配置'}
                    </div>
                    <div className="text-sm text-muted-foreground">Chat ID</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats?.config.only_title ? '是' : '否'}
                    </div>
                    <div className="text-sm text-muted-foreground">仅匹配标题</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {stats?.config.stop_push ? '是' : '否'}
                    </div>
                    <div className="text-sm text-muted-foreground">停止推送</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>订阅统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded">
                    <div className="text-3xl font-bold text-blue-600">{stats?.subscriptions.total || 0}</div>
                    <div className="text-sm text-muted-foreground">订阅总数</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-lg text-green-600">
                      {stats?.subscriptions.latest ? 
                        new Date(stats.subscriptions.latest).toLocaleDateString() : 
                        '无'}
                    </div>
                    <div className="text-sm text-muted-foreground">最新订阅时间</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>文章统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-blue-600">{stats?.posts.total || 0}</div>
                    <div className="text-sm text-muted-foreground">总文章数</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-green-600">{stats?.posts.matched || 0}</div>
                    <div className="text-sm text-muted-foreground">匹配文章数</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-purple-600">{stats?.posts.pushed || 0}</div>
                    <div className="text-sm text-muted-foreground">已推送文章数</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-orange-600">{stats?.posts.today || 0}</div>
                    <div className="text-sm text-muted-foreground">今日文章数</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">NodeSeek 监控仪表板</h1>
        <Button onClick={AuthUtils.logout} variant="outline">
          登出
        </Button>
      </div>

      {/* Bot Status */}
      {renderBotStatus()}

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            基础设置
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'subscriptions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            订阅管理
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'posts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            文章列表
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            统计信息
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}