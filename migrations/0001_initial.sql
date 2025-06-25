-- 配置表
CREATE TABLE IF NOT EXISTS base_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL, -- 用户名
  password TEXT NOT NULL, -- 密码
  bot_token TEXT DEFAULT NULL, -- telegram bot token
  chat_id TEXT NOT NULL, -- telegram chat id
  tg_name TEXT DEFAULT NULL, -- telegram 用户名
  tg_username TEXT DEFAULT NULL, -- telegram 用户名
  stop_push INTEGER DEFAULT 0, -- 是否停止推送
  only_title INTEGER DEFAULT 0, -- 是否只匹配标题
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- posts 表
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL, -- post id
  title TEXT NOT NULL, -- 标题
  memo TEXT NOT NULL, -- 备注
  category TEXT NOT NULL, -- 分类
  creator TEXT NOT NULL, -- 创建者
  push_status INTEGER DEFAULT 0, -- 推送状态 0 未推送 1 已推送 2 无需推送
  sub_id INTEGER DEFAULT NULL, -- 订阅id
  pub_date DATETIME NOT NULL, -- 发布时间
  push_date DATETIME DEFAULT NULL, -- 推送时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posts_post_id ON posts(post_id);

-- keywords_sub 表
CREATE TABLE IF NOT EXISTS keywords_sub (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword1 TEXT DEFAULT NULL, -- 关键词1
  keyword2 TEXT DEFAULT NULL, -- 关键词2
  keyword3 TEXT DEFAULT NULL, -- 关键词3
  creator TEXT NULL, -- 创建者
  category TEXT NULL, -- 分类
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

