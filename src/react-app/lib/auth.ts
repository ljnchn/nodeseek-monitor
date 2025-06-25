// 认证相关工具函数

const TOKEN_KEY = 'nodeseek_session_token';

export const AuthUtils = {
  // 保存token
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  // 获取token
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  // 移除token
  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  // 检查是否已登录
  isLoggedIn(): boolean {
    return !!this.getToken();
  },

  // 获取带认证头的请求配置
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  // 带认证的fetch
  async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 如果返回401，说明token失效，清除本地token
    if (response.status === 401) {
      this.removeToken();
      window.location.reload();
    }

    return response;
  },

  // 登出
  async logout(): Promise<void> {
    try {
      await this.authFetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.removeToken();
      window.location.reload();
    }
  }
}; 