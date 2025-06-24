import { BaseConfig, Post, KeywordSub } from './types';

export class Database {
  constructor(private db: D1Database) {}

  // 初始化数据表
  async initializeTables(): Promise<void> {
    const statements = [
      // 基础配置表
      `CREATE TABLE IF NOT EXISTS base_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        bot_token TEXT DEFAULT NULL,
        chat_id TEXT NOT NULL,
        stop_push INTEGER DEFAULT 0,
        only_title INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 文章表
      `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        memo TEXT NOT NULL,
        category TEXT NOT NULL,
        creator TEXT NOT NULL,
        push_status INTEGER DEFAULT 0,
        sub_id INTEGER DEFAULT NULL,
        pub_date DATETIME NOT NULL,
        push_date DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 文章表索引
      `CREATE INDEX IF NOT EXISTS idx_posts_post_id ON posts(post_id)`,
      
      // 关键词订阅表
      `CREATE TABLE IF NOT EXISTS keywords_sub (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword1 TEXT NOT NULL,
        keyword2 TEXT DEFAULT NULL,
        keyword3 TEXT DEFAULT NULL,
        creator TEXT NULL,
        category TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    try {
      for (const statement of statements) {
        await this.db.prepare(statement).run();
      }
      console.log('数据表初始化成功');
    } catch (error) {
      console.error('数据表初始化失败:', error);
      throw error;
    }
  }

  // 基础配置相关
  async getBaseConfig(): Promise<BaseConfig | null> {
    const result = await this.db.prepare('SELECT * FROM base_config LIMIT 1').first();
    return result as unknown as BaseConfig | null;
  }

  async createBaseConfig(config: Omit<BaseConfig, 'id' | 'created_at' | 'updated_at'>): Promise<BaseConfig> {
    const result = await this.db.prepare(`
      INSERT INTO base_config (username, password, bot_token, chat_id, stop_push, only_title)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      config.username,
      config.password,
      config.bot_token || null,
      config.chat_id,
      config.stop_push,
      config.only_title
    ).first();
    return result as unknown as BaseConfig;
  }

  async updateBaseConfig(config: Partial<BaseConfig>): Promise<BaseConfig | null> {
    const fields = [];
    const values = [];
    
    if (config.username !== undefined) {
      fields.push('username = ?');
      values.push(config.username);
    }
    if (config.password !== undefined) {
      fields.push('password = ?');
      values.push(config.password);
    }
    if (config.bot_token !== undefined) {
      fields.push('bot_token = ?');
      values.push(config.bot_token);
    }
    if (config.chat_id !== undefined) {
      fields.push('chat_id = ?');
      values.push(config.chat_id);
    }
    if (config.stop_push !== undefined) {
      fields.push('stop_push = ?');
      values.push(config.stop_push);
    }
    if (config.only_title !== undefined) {
      fields.push('only_title = ?');
      values.push(config.only_title);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const result = await this.db.prepare(`
      UPDATE base_config SET ${fields.join(', ')}
      WHERE id = (SELECT id FROM base_config LIMIT 1)
      RETURNING *
    `).bind(...values).first();

    return result as unknown as BaseConfig | null;
  }

  // 文章相关
  async createPost(post: Omit<Post, 'id' | 'created_at'>): Promise<Post> {
    const result = await this.db.prepare(`
      INSERT INTO posts (post_id, title, memo, category, creator, push_status, sub_id, pub_date, push_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      post.post_id,
      post.title,
      post.memo,
      post.category,
      post.creator,
      post.push_status,
      post.sub_id || null,
      post.pub_date,
      post.push_date || null
    ).first();
    return result as unknown as Post;
  }

  async getPostByPostId(postId: number): Promise<Post | null> {
    const result = await this.db.prepare('SELECT * FROM posts WHERE post_id = ?').bind(postId).first();
    return result as unknown as Post | null;
  }

  async getRecentPosts(limit: number = 10): Promise<Post[]> {
    const result = await this.db.prepare(`
      SELECT * FROM posts 
      ORDER BY pub_date DESC 
      LIMIT ?
    `).bind(limit).all();
    return result.results as unknown as Post[];
  }

  async updatePostPushStatus(postId: number, pushStatus: number, pushDate?: string, subId?: number): Promise<void> {
    await this.db.prepare(`
      UPDATE posts 
      SET push_status = ?, push_date = ?, sub_id = ?
      WHERE post_id = ?
    `).bind(pushStatus, pushDate || null, subId || null, postId).run();
  }

  // 关键词订阅相关
  async createKeywordSub(sub: Omit<KeywordSub, 'id' | 'created_at' | 'updated_at'>): Promise<KeywordSub> {
    const result = await this.db.prepare(`
      INSERT INTO keywords_sub (keyword1, keyword2, keyword3, creator, category)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      sub.keyword1,
      sub.keyword2 || null,
      sub.keyword3 || null,
      sub.creator || null,
      sub.category || null
    ).first();
    return result as unknown as KeywordSub;
  }

  async getKeywordSubs(): Promise<KeywordSub[]> {
    const result = await this.db.prepare('SELECT * FROM keywords_sub ORDER BY created_at DESC').all();
    return result.results as unknown as KeywordSub[];
  }

  async deleteKeywordSub(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM keywords_sub WHERE id = ?').bind(id).run();
  }

  async updateKeywordSub(id: number, sub: Partial<Omit<KeywordSub, 'id' | 'created_at' | 'updated_at'>>): Promise<KeywordSub | null> {
    const fields = [];
    const values = [];
    
    if (sub.keyword1 !== undefined) {
      fields.push('keyword1 = ?');
      values.push(sub.keyword1);
    }
    if (sub.keyword2 !== undefined) {
      fields.push('keyword2 = ?');
      values.push(sub.keyword2);
    }
    if (sub.keyword3 !== undefined) {
      fields.push('keyword3 = ?');
      values.push(sub.keyword3);
    }
    if (sub.creator !== undefined) {
      fields.push('creator = ?');
      values.push(sub.creator);
    }
    if (sub.category !== undefined) {
      fields.push('category = ?');
      values.push(sub.category);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const result = await this.db.prepare(`
      UPDATE keywords_sub SET ${fields.join(', ')}
      WHERE id = ?
      RETURNING *
    `).bind(...values, id).first();

    return result as unknown as KeywordSub | null;
  }
}