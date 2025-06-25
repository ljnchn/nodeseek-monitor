import { Database } from '../db/database';
import { Post } from '../db/types';
import { MatcherService } from './matcher';

export class TelegramService {
  constructor(private db: Database, private botToken: string) {}

  // 静态方法验证 bot token（不需要数据库实例）
  static async validateBotToken(botToken: string): Promise<{ valid: boolean; botInfo?: any; error?: string }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const result = await response.json();
      
      if (result.ok) {
        return { valid: true, botInfo: result.result };
      } else {
        return { valid: false, error: result.description || '无效的 bot token' };
      }
    } catch (error) {
      return { valid: false, error: '网络错误或无效的 bot token' };
    }
  }

  // 验证 bot token 是否有效
  async validateBotToken(): Promise<{ valid: boolean; botInfo?: any; error?: string }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const result = await response.json();
      
      if (result.ok) {
        return { valid: true, botInfo: result.result };
      } else {
        return { valid: false, error: result.description || '无效的 bot token' };
      }
    } catch (error) {
      return { valid: false, error: '网络错误或无效的 bot token' };
    }
  }

  async sendMessage(chatId: string, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });
      const result = await response.json() as { ok: boolean };
      return result.ok;
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      return false;
    }
  }

  async setWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
        }),
      });

      const result = await response.json() as { ok: boolean };
      return result.ok;
    } catch (error) {
      console.error('Error setting webhook:', error);
      return false;
    }
  }

  async handleWebhook(update: any): Promise<void> {
    if (!update.message || !update.message.text) return;

    const chatId = update.message.chat.id.toString();
    const text = update.message.text;
    const command = text.split(' ')[0];

    switch (command) {
      case '/start':
        await this.handleStart(chatId);
        break;
      case '/bind':
        await this.handleBind(chatId, update);
        break;
      case '/stop':
        await this.handleStop(chatId);
        break;
      case '/resume':
        await this.handleResume(chatId);
        break;
      case '/list':
        await this.handleList(chatId);
        break;
      case '/add':
        await this.handleAdd(chatId, text);
        break;
      case '/delete':
        await this.handleDelete(chatId, text);
        break;
      case '/post':
        await this.handlePost(chatId);
        break;
      case '/stats':
        await this.handleStats(chatId);
        break;
      case '/help':
        await this.handleHelp(chatId);
        break;
      default:
        await this.sendMessage(chatId, '❓ 未知命令。使用 /help 查看可用命令。');
    }
  }

  private async handleBind(chatId: string, update: any): Promise<void> {
    const config = await this.db.getBaseConfig();
    if (!config) {
      await this.sendMessage(chatId, '⚠️ 系统未初始化，请先在网页端完成初始化设置。');
      return;
    }

    // 获取用户信息
    const user = update.message.from;
    const userInfo = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      language_code: user.language_code
    };

    // 更新配置，绑定用户
    await this.db.updateBaseConfig({ 
      chat_id: chatId,
      telegram_user_info: JSON.stringify(userInfo)
    });

    const bindMessage = `
✅ 用户绑定成功！

👤 用户信息：
🆔 Chat ID: ${chatId}
📱 用户ID: ${user.id}
👋 用户名: ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}
🏷️ 用户名: ${user.username ? '@' + user.username : '无'}

🎉 您现在可以通过此机器人接收 NodeSeek 的监控通知了！

📋 可用命令：
/start - 显示帮助信息
/stop - 停止推送通知
/resume - 恢复推送通知  
/list - 列出所有订阅
/add <关键词> - 添加新订阅
/delete <ID> - 删除订阅
/post - 查看最近文章
/stats - 查看统计信息
/help - 显示详细帮助

💡 您也可以在网页端管理订阅和查看统计信息。
`;

    await this.sendMessage(chatId, bindMessage);
  }

  private async handleStart(chatId: string): Promise<void> {
    const config = await this.db.getBaseConfig();
    if (!config) {
      await this.sendMessage(chatId, '⚠️ 系统未初始化，请先在网页端完成初始化设置。');
      return;
    }

    // 更新 chat_id
    await this.db.updateBaseConfig({ chat_id: chatId });

    const helpText = `
🎉 欢迎使用 NodeSeek 监控机器人！

📋 可用命令：
/start - 显示此帮助信息
/bind - 绑定当前用户
/stop - 停止推送通知
/resume - 恢复推送通知  
/list - 列出所有订阅
/add <关键词1> [关键词2] [关键词3] - 添加新订阅
/delete <订阅ID> - 删除指定订阅
/post - 查看最近文章及推送状态
/stats - 查看统计信息
/help - 显示详细帮助

📊 当前状态：${config.stop_push ? '🔴 已停止推送' : '🟢 正常推送'}
⚙️ 匹配模式：${config.only_title ? '仅标题' : '标题+内容'}

💡 使用示例：
/add VPS 优惠 - 添加包含"VPS"和"优惠"的订阅
/add 甲骨文 creator:用户名 - 添加特定用户发布的甲骨文相关文章
`;

    await this.sendMessage(chatId, helpText);
  }

  private async handleStop(chatId: string): Promise<void> {
    await this.db.updateBaseConfig({ stop_push: 1 });
    await this.sendMessage(chatId, '🔴 已停止推送通知。使用 /resume 命令恢复推送。');
  }

  private async handleResume(chatId: string): Promise<void> {
    await this.db.updateBaseConfig({ stop_push: 0 });
    await this.sendMessage(chatId, '🟢 已恢复推送通知。');
  }

  private async handleList(chatId: string): Promise<void> {
    const subs = await this.db.getKeywordSubs();
    
    if (subs.length === 0) {
      await this.sendMessage(chatId, '📝 暂无订阅。使用 /add 命令添加订阅。');
      return;
    }

    let message = '📋 当前订阅列表：\n\n';
    subs.forEach((sub, index) => {
      const keywords = [sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean).join(' + ');
      message += `${index + 1}. 🆔 ${sub.id} - 🔍 ${keywords}\n`;
      if (sub.creator) message += `   👤 创建者: ${sub.creator}\n`;
      if (sub.category) message += `   📂 分类: ${sub.category}\n`;
      message += `   📅 创建时间: ${new Date(sub.created_at!).toLocaleString('zh-CN')}\n`;
      message += '\n';
    });

    message += `\n📊 共 ${subs.length} 个订阅`;

    await this.sendMessage(chatId, message);
  }

  private async handleAdd(chatId: string, text: string): Promise<void> {
    const parts = text.split(' ').slice(1); // 移除 /add
    
    if (parts.length === 0) {
      await this.sendMessage(chatId, `❗ 请提供关键词。

格式：/add <关键词1> [关键词2] [关键词3]

示例：
/add VPS 优惠
/add 甲骨文 云服务
/add Docker 教程 入门`);
      return;
    }

    // 解析特殊参数
    let creator: string | undefined;
    let category: string | undefined;
    const keywords: string[] = [];

    for (const part of parts) {
      if (part.startsWith('creator:') || part.startsWith('作者:')) {
        creator = part.split(':')[1];
      } else if (part.startsWith('category:') || part.startsWith('分类:')) {
        category = part.split(':')[1];
      } else {
        keywords.push(part);
      }
    }

    if (keywords.length === 0) {
      await this.sendMessage(chatId, '❗ 至少需要一个关键词。');
      return;
    }

    try {
      const sub = await this.db.createKeywordSub({
        keyword1: keywords[0],
        keyword2: keywords[1] || undefined,
        keyword3: keywords[2] || undefined,
        creator,
        category,
      });

      const keywordStr = [sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean).join(' + ');
      let message = `✅ 订阅添加成功！\n\n🆔 ID: ${sub.id}\n🔍 关键词: ${keywordStr}`;
      
      if (sub.creator) message += `\n👤 创建者: ${sub.creator}`;
      if (sub.category) message += `\n📂 分类: ${sub.category}`;
      
      await this.sendMessage(chatId, message);
    } catch (error) {
      console.error('添加订阅失败:', error);
      await this.sendMessage(chatId, '❌ 添加订阅失败，请稍后重试。');
    }
  }

  private async handleDelete(chatId: string, text: string): Promise<void> {
    const parts = text.split(' ');
    
    if (parts.length < 2) {
      await this.sendMessage(chatId, `❗ 请提供订阅ID。

格式：/delete <订阅ID>

示例：/delete 1

💡 使用 /list 查看所有订阅ID`);
      return;
    }

    const id = parseInt(parts[1], 10);
    if (isNaN(id)) {
      await this.sendMessage(chatId, '❗ 订阅ID必须是数字。');
      return;
    }

    try {
      // 先检查订阅是否存在
      const subs = await this.db.getKeywordSubs();
      const sub = subs.find(s => s.id === id);
      
      if (!sub) {
        await this.sendMessage(chatId, `❌ 订阅 ID ${id} 不存在。使用 /list 查看所有订阅。`);
        return;
      }

      await this.db.deleteKeywordSub(id);
      
      const keywords = [sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean).join(' + ');
      await this.sendMessage(chatId, `✅ 订阅删除成功！\n\n🆔 ID: ${id}\n🔍 关键词: ${keywords}`);
    } catch (error) {
      console.error('删除订阅失败:', error);
      await this.sendMessage(chatId, '❌ 删除订阅失败，请稍后重试。');
    }
  }

  private async handlePost(chatId: string): Promise<void> {
    const posts = await this.db.getRecentPosts(10);
    
    if (posts.length === 0) {
      await this.sendMessage(chatId, '📰 暂无文章数据。');
      return;
    }

    let message = '📰 最近十条文章：\n\n';
    posts.forEach((post, index) => {
      const statusEmoji = post.push_status === 0 ? '⏳' : 
                         post.push_status === 1 ? '✅' : '❌';
      const statusText = post.push_status === 0 ? '未推送' : 
                        post.push_status === 1 ? '已推送' : '无需推送';
      
      message += `${index + 1}. ${statusEmoji} ${post.title}\n`;
      message += `   👤 ${post.creator} | 📂 ${post.category}\n`;
      message += `   📊 ${statusText} | 📅 ${new Date(post.pub_date).toLocaleString('zh-CN')}\n\n`;
    });

    await this.sendMessage(chatId, message);
  }

  private async handleStats(chatId: string): Promise<void> {
    try {
      const config = await this.db.getBaseConfig();
      const subs = await this.db.getKeywordSubs();
      const posts = await this.db.getRecentPosts(100); // 获取更多数据用于统计

      if (!config) {
        await this.sendMessage(chatId, '❌ 系统未初始化。');
        return;
      }

      const stats = MatcherService.getMatchStats(posts, subs, config);
      
      const message = `
📊 系统统计信息

🔧 配置状态：
• 推送状态：${config.stop_push ? '🔴 已停止' : '🟢 正常'}
• 匹配模式：${config.only_title ? '仅标题' : '标题+内容'}
• Bot 状态：${config.bot_token ? '✅ 已配置' : '❌ 未配置'}
• Chat ID：${config.chat_id || '未设置'}

📝 订阅统计：
• 总订阅数：${subs.length} 个
• 最新订阅：${subs.length > 0 ? new Date(subs[0].created_at!).toLocaleDateString('zh-CN') : '无'}

📰 文章统计（最近100条）：
• 总文章数：${stats.totalPosts} 篇
• 匹配文章：${stats.matchedPosts} 篇
• 未匹配文章：${stats.unmatchedPosts} 篇
• 匹配率：${stats.matchRate.toFixed(1)}%

🔥 热门关键词：
${stats.topKeywords.slice(0, 5).map((kw, i) => `${i + 1}. ${kw.keyword} (${kw.count}次)`).join('\n') || '暂无数据'}
`;

      await this.sendMessage(chatId, message);
    } catch (error) {
      console.error('获取统计信息失败:', error);
      await this.sendMessage(chatId, '❌ 获取统计信息失败，请稍后重试。');
    }
  }

  private async handleHelp(chatId: string): Promise<void> {
    const helpText = `
📚 详细帮助文档

🎯 基本命令：
• /start - 开始使用并绑定Chat ID
• /help - 显示此详细帮助
• /stats - 查看系统统计信息

🔔 推送控制：
• /stop - 停止推送通知
• /resume - 恢复推送通知

📝 订阅管理：
• /list - 列出所有订阅
• /add <关键词> - 添加订阅
• /delete <ID> - 删除订阅

📰 文章查看：
• /post - 查看最近文章

🔍 高级订阅语法：
• /add VPS 优惠 - 同时包含"VPS"和"优惠"
• /add 甲骨文 creator:用户名 - 特定用户的甲骨文文章
• /add Docker category:教程 - 教程分类的Docker文章

💡 使用技巧：
• 关键词匹配支持中文分词
• 可以设置最多3个关键词（AND逻辑）
• 支持按作者和分类过滤
• 推送消息包含完整文章信息

❓ 常见问题：
• 如何停止推送？使用 /stop 命令
• 如何查看订阅？使用 /list 命令
• 如何删除订阅？使用 /delete <订阅ID>
• 系统支持哪些关键词？支持中英文和数字

🌐 项目地址：
https://github.com/ljnchn/NodeSeeker
`;

    await this.sendMessage(chatId, helpText);
  }

  async sendPostNotification(post: Post, matchedKeywords: string[]): Promise<boolean> {
    const config = await this.db.getBaseConfig();
    if (!config || !config.chat_id || config.stop_push) {
      return false;
    }

    const message = `
🔔 <b>NodeSeek 新文章匹配</b>

<b>📝 标题:</b> ${post.title}
<b>👤 作者:</b> ${post.creator}
<b>📂 分类:</b> ${post.category}
<b>🔍 匹配关键词:</b> ${matchedKeywords.join(', ')}

<b>📄 摘要:</b> ${post.memo.substring(0, 200)}${post.memo.length > 200 ? '...' : ''}

<b>📅 发布时间:</b> ${new Date(post.pub_date).toLocaleString('zh-CN')}

<b>🔗 链接:</b> 查看完整内容请访问 NodeSeek 官网
`;

    return await this.sendMessage(config.chat_id, message);
  }
}