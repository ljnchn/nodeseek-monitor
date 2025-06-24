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
        alert('Webhook set successfully!');
      } else {
        alert('Failed to set webhook');
      }
    } catch (error) {
      console.error('Failed to set webhook:', error);
      alert('Failed to set webhook');
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
    if (!confirm('Are you sure you want to delete this subscription?')) return;

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
        alert(`RSS processed: ${result.processed} posts, ${result.matched} matched`);
        loadData();
      } else {
        alert('Failed to process RSS');
      }
    } catch (error) {
      console.error('Failed to process RSS:', error);
      alert('Failed to process RSS');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">NodeSeek Monitor Dashboard</h1>

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Settings</CardTitle>
          <CardDescription>Configure Telegram bot and monitoring settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="botToken">Telegram Bot Token</Label>
              <div className="flex gap-2">
                <Input
                  id="botToken"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Enter your bot token"
                />
                <Button onClick={setBotWebhook}>Set Webhook</Button>
              </div>
              <p className="text-sm text-gray-600">
                Status: {config?.bot_token ? 'Configured' : 'Not configured'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatId">Telegram Chat ID</Label>
              <Input
                id="chatId"
                value={config?.chat_id || ''}
                onChange={(e) => updateConfig({ chat_id: e.target.value })}
                placeholder="Your chat ID"
              />
              <p className="text-sm text-gray-600">
                Status: {config?.chat_id ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={config?.only_title === 1}
                onCheckedChange={(checked) => updateConfig({ only_title: checked ? 1 : 0 })}
              />
              <Label>Only match title</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={config?.stop_push === 1}
                onCheckedChange={(checked) => updateConfig({ stop_push: checked ? 1 : 0 })}
              />
              <Label>Stop push notifications</Label>
            </div>
          </div>

          <Button onClick={processRSS} className="w-full">
            Process RSS Now
          </Button>
        </CardContent>
      </Card>

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Management</CardTitle>
          <CardDescription>Manage your keyword subscriptions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new subscription */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="Keyword 1 (required)"
              value={newSub.keyword1}
              onChange={(e) => setNewSub({ ...newSub, keyword1: e.target.value })}
            />
            <Input
              placeholder="Keyword 2 (optional)"
              value={newSub.keyword2}
              onChange={(e) => setNewSub({ ...newSub, keyword2: e.target.value })}
            />
            <Input
              placeholder="Keyword 3 (optional)"
              value={newSub.keyword3}
              onChange={(e) => setNewSub({ ...newSub, keyword3: e.target.value })}
            />
            <Input
              placeholder="Creator filter (optional)"
              value={newSub.creator}
              onChange={(e) => setNewSub({ ...newSub, creator: e.target.value })}
            />
            <Input
              placeholder="Category filter (optional)"
              value={newSub.category}
              onChange={(e) => setNewSub({ ...newSub, category: e.target.value })}
            />
            <Button onClick={addSubscription} className="flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Add Subscription
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
                    <div className="text-sm text-gray-600">
                      {sub.creator && `Creator: ${sub.creator}`}
                      {sub.creator && sub.category && ' | '}
                      {sub.category && `Category: ${sub.category}`}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Created: {new Date(sub.created_at).toLocaleString()}
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
          <CardTitle>Recent Posts</CardTitle>
          <CardDescription>Latest posts and their push status</CardDescription>
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
                    <div className="text-xs text-gray-500 mt-2">
                      Author: {post.creator} | Category: {post.category} | 
                      Published: {new Date(post.pub_date).toLocaleString()}
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      post.push_status === 0 ? 'bg-yellow-100 text-yellow-800' :
                      post.push_status === 1 ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {post.push_status === 0 ? 'Not pushed' :
                       post.push_status === 1 ? 'Pushed' : 'No need to push'}
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