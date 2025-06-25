import { Hono } from "hono";
import { Database } from "./db/database";
import { RSSService } from "./services/rss";
import { TelegramService } from "./services/telegram";
import { SchedulerService } from "./services/scheduler";
import { MatcherService } from "./services/matcher";

const app = new Hono<{ Bindings: Env }>();

// 简单的内存session存储（生产环境应该使用数据库或Redis）
const activeSessions = new Set<string>();

// 生成session token
function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 认证中间件
const authMiddleware = async (c: any, next: any) => {
  // 跳过不需要认证的路径
  const publicPaths = ['/api/init', '/api/login', '/api/logout', '/api/health', '/api/telegram/webhook', '/api/validate-bot-token', '/api/config'];
  if (publicPaths.some(path => c.req.path.startsWith(path))) {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token || !activeSessions.has(token)) {
    return c.json({ error: '未授权访问' }, 401);
  }
  
  await next();
};

// 自动初始化数据库的中间件
app.use("*", async (c, next) => {
  // 仅在第一次访问时初始化数据库
  if (!c.env.__initialized) {
    const db = new Database(c.env.DB);
    try {
      await db.initializeTables();
      c.env.__initialized = true;
      console.log("数据库自动初始化成功");
    } catch (error) {
      console.error("数据库自动初始化失败:", error);
    }
  }
  await next();
});

// CORS middleware
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (c.req.method === "OPTIONS") {
    return c.text("", 200);
  }
  
  await next();
});

// 应用认证中间件
app.use("*", authMiddleware);

// Database initialization API
app.post("/api/init", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    await db.initializeTables();
    return c.json({ success: true, message: "数据库初始化成功" });
  } catch (error) {
    console.error("数据库初始化失败:", error);
    return c.json({ error: "数据库初始化失败" }, 500);
  }
});

// Base config API
app.get("/api/config", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const config = await db.getBaseConfig();
    
    if (!config) {
      return c.json({ error: "系统未初始化" }, 404);
    }
    
    // 检查是否有有效的认证token
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isAuthenticated = token && activeSessions.has(token);
    
    if (isAuthenticated) {
      // 已认证，返回完整配置（除了密码）
      const { password, ...safeConfig } = config;
      return c.json(safeConfig);
    } else {
      // 未认证，只返回系统是否已初始化的状态
      return c.json({ initialized: true });
    }
  } catch (error) {
    console.error("获取配置失败:", error);
    return c.json({ error: "获取配置失败" }, 500);
  }
});

app.post("/api/config", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const body = await c.req.json();
    
    // 检查是否已认证
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isAuthenticated = token && activeSessions.has(token);
    
    const existingConfig = await db.getBaseConfig();
    
    if (existingConfig) {
      // 如果配置已存在
      if (isAuthenticated) {
        // 已认证用户可以更新任何字段（除了用户名密码需要提供旧的）
        const updatedConfig = await db.updateBaseConfig(body);
        const { password, ...safeConfig } = updatedConfig!;
        return c.json(safeConfig);
      } else {
        // 未认证用户只能在初始化时设置完整配置
        if (!body.username || !body.password) {
          return c.json({ error: "用户名和密码为必填项" }, 400);
        }
        const updatedConfig = await db.updateBaseConfig(body);
        const { password, ...safeConfig } = updatedConfig!;
        return c.json(safeConfig);
      }
    } else {
      // 配置不存在，创建新配置（初始化时）
      if (!body.username || !body.password) {
        return c.json({ error: "用户名和密码为必填项" }, 400);
      }
      
      const configData = {
        ...body,
        chat_id: body.chat_id || 'temp_chat_id'
      };
      const newConfig = await db.createBaseConfig(configData);
      const { password, ...safeConfig } = newConfig;
      return c.json(safeConfig);
    }
  } catch (error) {
    console.error("保存配置失败:", error);
    return c.json({ error: "保存配置失败" }, 500);
  }
});

// Validate Bot Token API
app.post("/api/validate-bot-token", async (c) => {
  try {
    const { botToken } = await c.req.json();
    
    if (!botToken) {
      return c.json({ error: "Bot token 不能为空" }, 400);
    }
    
    const validation = await TelegramService.validateBotToken(botToken);
    
    if (validation.valid) {
      return c.json({ 
        valid: true, 
        botInfo: validation.botInfo,
        message: "Bot token 验证成功" 
      });
    } else {
      return c.json({ 
        valid: false, 
        error: validation.error 
      }, 400);
    }
  } catch (error) {
    console.error("验证 bot token 失败:", error);
    return c.json({ error: "验证 bot token 失败" }, 500);
  }
});

// Login API
app.post("/api/login", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({ error: "用户名和密码不能为空" }, 400);
    }
    
    const config = await db.getBaseConfig();
    if (!config) {
      return c.json({ error: "系统未初始化" }, 400);
    }
    
    if (config.username !== username || config.password !== password) {
      return c.json({ error: "用户名或密码错误" }, 401);
    }
    
    const sessionToken = generateSessionToken();
    activeSessions.add(sessionToken);
    
    return c.json({ success: true, message: "登录成功", sessionToken });
  } catch (error) {
    console.error("登录失败:", error);
    return c.json({ error: "登录失败" }, 500);
  }
});

// Logout API
app.post("/api/logout", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token) {
      activeSessions.delete(token);
    }
    
    return c.json({ success: true, message: "登出成功" });
  } catch (error) {
    console.error("登出失败:", error);
    return c.json({ error: "登出失败" }, 500);
  }
});

// Subscription management API
app.get("/api/subscriptions", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const subs = await db.getKeywordSubs();
    return c.json(subs);
  } catch (error) {
    console.error("获取订阅列表失败:", error);
    return c.json({ error: "获取订阅列表失败" }, 500);
  }
});

app.post("/api/subscriptions", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const body = await c.req.json();
    
    // 验证关键词
    const keywords = [body.keyword1, body.keyword2, body.keyword3];
    const validation = MatcherService.validateKeywords(keywords);
    
    if (!validation.valid) {
      return c.json({ error: validation.errors.join(', ') }, 400);
    }
    
    const sub = await db.createKeywordSub(body);
    return c.json(sub);
  } catch (error) {
    console.error("创建订阅失败:", error);
    return c.json({ error: "创建订阅失败" }, 500);
  }
});

app.put("/api/subscriptions/:id", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    
    if (isNaN(id)) {
      return c.json({ error: "订阅ID必须是数字" }, 400);
    }
    
    // 验证关键词
    const keywords = [body.keyword1, body.keyword2, body.keyword3];
    const validation = MatcherService.validateKeywords(keywords);
    
    if (!validation.valid) {
      return c.json({ error: validation.errors.join(', ') }, 400);
    }
    
    const sub = await db.updateKeywordSub(id, body);
    if (!sub) {
      return c.json({ error: "订阅不存在" }, 404);
    }
    return c.json(sub);
  } catch (error) {
    console.error("更新订阅失败:", error);
    return c.json({ error: "更新订阅失败" }, 500);
  }
});

app.delete("/api/subscriptions/:id", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const id = parseInt(c.req.param("id"));
    
    if (isNaN(id)) {
      return c.json({ error: "订阅ID必须是数字" }, 400);
    }
    
    await db.deleteKeywordSub(id);
    return c.json({ success: true, message: "订阅删除成功" });
  } catch (error) {
    console.error("删除订阅失败:", error);
    return c.json({ error: "删除订阅失败" }, 500);
  }
});

// Posts API
app.get("/api/posts", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const limit = parseInt(c.req.query("limit") || "10");
    
    if (limit < 1 || limit > 100) {
      return c.json({ error: "limit 参数必须在 1-100 之间" }, 400);
    }
    
    const posts = await db.getRecentPosts(limit);
    return c.json(posts);
  } catch (error) {
    console.error("获取文章列表失败:", error);
    return c.json({ error: "获取文章列表失败" }, 500);
  }
});

// Statistics API
app.get("/api/stats", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const config = await db.getBaseConfig();
    const subs = await db.getKeywordSubs();
    const posts = await db.getRecentPosts(100);
    
    if (!config) {
      return c.json({ error: "系统未初始化" }, 400);
    }
    
    const stats = MatcherService.getMatchStats(posts, subs, config);
    
    return c.json({
      config: {
        stop_push: config.stop_push,
        only_title: config.only_title,
        has_bot_token: !!config.bot_token,
        has_chat_id: !!config.chat_id
      },
      subscriptions: {
        total: subs.length,
        latest: subs.length > 0 ? subs[0].created_at : null
      },
      posts: stats
    });
  } catch (error) {
    console.error("获取统计信息失败:", error);
    return c.json({ error: "获取统计信息失败" }, 500);
  }
});

// Telegram Webhook
app.post("/api/telegram/webhook", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const config = await db.getBaseConfig();
    
    if (!config || !config.bot_token) {
      return c.json({ error: "Telegram 机器人未配置" }, 400);
    }
    
    const telegramService = new TelegramService(db, config.bot_token);
    const update = await c.req.json();
    
    await telegramService.handleWebhook(update);
    return c.json({ ok: true });
  } catch (error) {
    console.error("Webhook 处理失败:", error);
    return c.json({ error: "Webhook 处理失败" }, 500);
  }
});

// Get Bot User Info (for binding user)
app.post("/api/telegram/get-user-info", async (c) => {
  try {
    const { botToken, chatId } = await c.req.json();
    
    if (!botToken) {
      return c.json({ error: "Bot token 不能为空" }, 400);
    }
    
    if (!chatId) {
      return c.json({ error: "Chat ID 不能为空" }, 400);
    }
    
    // 验证 bot token
    const validation = await TelegramService.validateBotToken(botToken);
    
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }
    
    // 获取用户信息
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
        }),
      });
      
      const result = await response.json() as { ok: boolean; result?: any; description?: string };
      
      if (result.ok) {
        return c.json({
          success: true,
          userInfo: result.result,
          message: "用户信息获取成功"
        });
      } else {
        return c.json({ 
          error: "无法获取用户信息，请检查 Chat ID 是否正确" 
        }, 400);
      }
    } catch (error) {
      return c.json({ 
        error: "获取用户信息失败" 
      }, 500);
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
    return c.json({ error: "获取用户信息失败" }, 500);
  }
});

// Set Telegram Webhook
app.post("/api/telegram/set-webhook", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const { webhookUrl, botToken } = await c.req.json();
    
    if (!webhookUrl) {
      return c.json({ error: "Webhook URL 不能为空" }, 400);
    }
    
    // 确定要使用的 bot token
    let effectiveBotToken = botToken;
    
    if (!effectiveBotToken) {
      // 如果请求中没有提供 bot token，尝试从数据库获取
      const config = await db.getBaseConfig();
      if (!config || !config.bot_token) {
        return c.json({ error: "Telegram 机器人未配置" }, 400);
      }
      effectiveBotToken = config.bot_token;
    }
    
    const telegramService = new TelegramService(db, effectiveBotToken);
    const success = await telegramService.setWebhook(webhookUrl);
    
    return c.json({ 
      success, 
      message: success ? "Webhook 设置成功" : "Webhook 设置失败" 
    });
  } catch (error) {
    console.error("设置 Webhook 失败:", error);
    return c.json({ error: "设置 Webhook 失败" }, 500);
  }
});

// Manual RSS processing trigger
app.post("/api/process-rss", async (c) => {
  const db = new Database(c.env.DB);
  
  try {
    const config = await db.getBaseConfig();
    
    if (!config) {
      return c.json({ error: "系统未初始化" }, 400);
    }
    
    const rssService = new RSSService();
    const telegramService = config.bot_token ? new TelegramService(db, config.bot_token) : null;
    
    if (!telegramService) {
      return c.json({ error: "Telegram 机器人未配置" }, 400);
    }
    
    const schedulerService = new SchedulerService(db, rssService, telegramService);
    const result = await schedulerService.processRSSFeed();
    
    return c.json({
      success: true,
      ...result,
      message: `RSS 处理完成：处理了 ${result.processed} 篇文章，匹配了 ${result.matched} 篇`
    });
  } catch (error) {
    console.error("RSS 处理失败:", error);
    return c.json({ error: `RSS 处理失败: ${error instanceof Error ? error.message : '未知错误'}` }, 500);
  }
});

// Health check
app.get("/api/health", async (c) => {
  return c.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    message: "NodeSeek 监控系统运行正常"
  });
});

// Scheduled task handler (called by Cloudflare Cron Triggers)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  },
  
  async scheduled(env: Env): Promise<void> {
    console.log("开始执行定时任务...");
    
    const db = new Database(env.DB);
    
    try {
      const config = await db.getBaseConfig();
      
      if (!config || !config.bot_token) {
        console.log("系统未配置，跳过定时任务");
        return;
      }
      
      const rssService = new RSSService();
      const telegramService = new TelegramService(db, config.bot_token);
      const schedulerService = new SchedulerService(db, rssService, telegramService);
      
      const result = await schedulerService.processRSSFeed();
      console.log("定时任务完成:", result);
    } catch (error) {
      console.error("定时任务失败:", error);
    }
  }
};