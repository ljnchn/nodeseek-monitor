import { Hono } from "hono";
import { Database } from "./db/database";
import { RSSService } from "./services/rss";
import { TelegramService } from "./services/telegram";
import { SchedulerService } from "./services/scheduler";

const app = new Hono<{ Bindings: Env }>();

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
  const config = await db.getBaseConfig();
  
  if (!config) {
    return c.json({ error: "Not initialized" }, 404);
  }
  
  // Don't return password
  const { password, ...safeConfig } = config;
  return c.json(safeConfig);
});

app.post("/api/config", async (c) => {
  const db = new Database(c.env.DB);
  const body = await c.req.json();
  
  try {
    const existingConfig = await db.getBaseConfig();
    
    if (existingConfig) {
      const updatedConfig = await db.updateBaseConfig(body);
      const { password, ...safeConfig } = updatedConfig!;
      return c.json(safeConfig);
    } else {
      const newConfig = await db.createBaseConfig(body);
      const { password, ...safeConfig } = newConfig;
      return c.json(safeConfig);
    }
  } catch (error) {
    return c.json({ error: "Failed to save config" }, 500);
  }
});

// Login API
app.post("/api/login", async (c) => {
  const db = new Database(c.env.DB);
  const { username, password } = await c.req.json();
  
  const config = await db.getBaseConfig();
  if (!config || config.username !== username || config.password !== password) {
    return c.json({ error: "Invalid username or password" }, 401);
  }
  
  return c.json({ success: true });
});

// Subscription management API
app.get("/api/subscriptions", async (c) => {
  const db = new Database(c.env.DB);
  const subs = await db.getKeywordSubs();
  return c.json(subs);
});

app.post("/api/subscriptions", async (c) => {
  const db = new Database(c.env.DB);
  const body = await c.req.json();
  
  try {
    const sub = await db.createKeywordSub(body);
    return c.json(sub);
  } catch (error) {
    return c.json({ error: "Failed to create subscription" }, 500);
  }
});

app.put("/api/subscriptions/:id", async (c) => {
  const db = new Database(c.env.DB);
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json();
  
  try {
    const sub = await db.updateKeywordSub(id, body);
    if (!sub) {
      return c.json({ error: "Subscription not found" }, 404);
    }
    return c.json(sub);
  } catch (error) {
    return c.json({ error: "Failed to update subscription" }, 500);
  }
});

app.delete("/api/subscriptions/:id", async (c) => {
  const db = new Database(c.env.DB);
  const id = parseInt(c.req.param("id"));
  
  try {
    await db.deleteKeywordSub(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete subscription" }, 500);
  }
});

// Posts API
app.get("/api/posts", async (c) => {
  const db = new Database(c.env.DB);
  const limit = parseInt(c.req.query("limit") || "10");
  const posts = await db.getRecentPosts(limit);
  return c.json(posts);
});

// Telegram Webhook
app.post("/api/telegram/webhook", async (c) => {
  const db = new Database(c.env.DB);
  const config = await db.getBaseConfig();
  
  if (!config || !config.bot_token) {
    return c.json({ error: "Bot not configured" }, 400);
  }
  
  const telegramService = new TelegramService(db, config.bot_token);
  const update = await c.req.json();
  
  try {
    await telegramService.handleWebhook(update);
    return c.json({ ok: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return c.json({ error: "Processing failed" }, 500);
  }
});

// Set Telegram Webhook
app.post("/api/telegram/set-webhook", async (c) => {
  const db = new Database(c.env.DB);
  const config = await db.getBaseConfig();
  
  if (!config || !config.bot_token) {
    return c.json({ error: "Bot not configured" }, 400);
  }
  
  const telegramService = new TelegramService(db, config.bot_token);
  const { webhookUrl } = await c.req.json();
  
  try {
    const success = await telegramService.setWebhook(webhookUrl);
    return c.json({ success });
  } catch (error) {
    return c.json({ error: "Failed to set webhook" }, 500);
  }
});

// Manual RSS processing trigger
app.post("/api/process-rss", async (c) => {
  const db = new Database(c.env.DB);
  const config = await db.getBaseConfig();
  
  if (!config) {
    return c.json({ error: "System not initialized" }, 400);
  }
  
  const rssService = new RSSService();
  const telegramService = config.bot_token ? new TelegramService(db, config.bot_token) : null;
  
  if (!telegramService) {
    return c.json({ error: "Telegram Bot not configured" }, 400);
  }
  
  const schedulerService = new SchedulerService(db, rssService, telegramService);
  
  try {
    const result = await schedulerService.processRSSFeed();
    return c.json(result);
  } catch (error) {
    return c.json({ error: "RSS processing failed" }, 500);
  }
});

// Scheduled task handler (called by Cloudflare Cron Triggers)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  },
  
  async scheduled(env: Env): Promise<void> {
    const db = new Database(env.DB);
    const config = await db.getBaseConfig();
    
    if (!config || !config.bot_token) {
      console.log("System not configured, skipping scheduled task");
      return;
    }
    
    const rssService = new RSSService();
    const telegramService = new TelegramService(db, config.bot_token);
    const schedulerService = new SchedulerService(db, rssService, telegramService);
    
    try {
      const result = await schedulerService.processRSSFeed();
      console.log("Scheduled task completed:", result);
    } catch (error) {
      console.error("Scheduled task failed:", error);
    }
  }
};