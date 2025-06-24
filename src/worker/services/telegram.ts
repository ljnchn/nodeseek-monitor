import { Database } from '../db/database';
import { Post } from '../db/types';

export class TelegramService {
  constructor(private db: Database, private botToken: string) {}

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
      default:
        await this.sendMessage(chatId, '未知命令。使用 /start 查看可用命令。');
    }
  }

  private async handleStart(chatId: string): Promise<void> {
    const config = await this.db.getBaseConfig();
    if (!config) {
      await this.sendMessage(chatId, '系统未初始化，请先在网页端完成初始化设置。');
      return;
    }

    // 更新 chat_id
    await this.db.updateBaseConfig({ chat_id: chatId });

    const helpText = `
欢迎使用 NodeSeek 监控机器人！

可用命令：
/start - 显示此帮助信息
/stop - 停止推送
/resume - 恢复推送
/list - 列出所有订阅
/add <关键词1> [关键词2] [关键词3] - 添加订阅
/delete <订阅ID> - 删除订阅
/post - 查看最近十条文章及推送状态

当前状态：${config.stop_push ? '已停止推送' : '正常推送'}
`;

    await this.sendMessage(chatId, helpText);
  }

  private async handleStop(chatId: string): Promise<void> {
    await this.db.updateBaseConfig({ stop_push: 1 });
    await this.sendMessage(chatId, '已停止推送。使用 /resume 恢复推送。');
  }

  private async handleResume(chatId: string): Promise<void> {
    await this.db.updateBaseConfig({ stop_push: 0 });
    await this.sendMessage(chatId, '已恢复推送。');
  }

  private async handleList(chatId: string): Promise<void> {
    const subs = await this.db.getKeywordSubs();
    
    if (subs.length === 0) {
      await this.sendMessage(chatId, '暂无订阅。使用 /add 添加订阅。');
      return;
    }

    let message = '当前订阅列表：\n\n';
    subs.forEach((sub, index) => {
      const keywords = [sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean).join(' + ');
      message += `${index + 1}. ID: ${sub.id} - ${keywords}\n`;
      if (sub.creator) message += `   创建者: ${sub.creator}\n`;
      if (sub.category) message += `   分类: ${sub.category}\n`;
      message += '\n';
    });

    await this.sendMessage(chatId, message);
  }

  private async handleAdd(chatId: string, text: string): Promise<void> {
    const parts = text.split(' ').slice(1); // 移除 /add
    
    if (parts.length === 0) {
      await this.sendMessage(chatId, '请提供关键词。格式：/add <关键词1> [关键词2] [关键词3]');
      return;
    }

    try {
      const sub = await this.db.createKeywordSub({
        keyword1: parts[0],
        keyword2: parts[1] || undefined,
        keyword3: parts[2] || undefined,
      });

      const keywords = [sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean).join(' + ');
      await this.sendMessage(chatId, `订阅添加成功！\nID: ${sub.id}\n关键词: ${keywords}`);
    } catch (error) {
      await this.sendMessage(chatId, '添加订阅失败，请稍后重试。');
    }
  }

  private async handleDelete(chatId: string, text: string): Promise<void> {
    const parts = text.split(' ');
    
    if (parts.length < 2) {
      await this.sendMessage(chatId, '请提供订阅ID。格式：/delete <订阅ID>');
      return;
    }

    const id = parseInt(parts[1], 10);
    if (isNaN(id)) {
      await this.sendMessage(chatId, '订阅ID必须是数字。');
      return;
    }

    try {
      await this.db.deleteKeywordSub(id);
      await this.sendMessage(chatId, `订阅 ${id} 删除成功！`);
    } catch (error) {
      await this.sendMessage(chatId, '删除订阅失败，请检查订阅ID是否正确。');
    }
  }

  private async handlePost(chatId: string): Promise<void> {
    const posts = await this.db.getRecentPosts(10);
    
    if (posts.length === 0) {
      await this.sendMessage(chatId, '暂无文章数据。');
      return;
    }

    let message = '最近十条文章：\n\n';
    posts.forEach((post, index) => {
      const statusText = post.push_status === 0 ? '未推送' : 
                        post.push_status === 1 ? '已推送' : '无需推送';
      
      message += `${index + 1}. ${post.title}\n`;
      message += `   作者: ${post.creator} | 分类: ${post.category}\n`;
      message += `   状态: ${statusText}\n`;
      message += `   时间: ${new Date(post.pub_date).toLocaleString()}\n\n`;
    });

    await this.sendMessage(chatId, message);
  }

  async sendPostNotification(post: Post, matchedKeywords: string[]): Promise<boolean> {
    const config = await this.db.getBaseConfig();
    if (!config || !config.chat_id || config.stop_push) {
      return false;
    }

    const message = `
🔔 <b>新文章匹配</b>

<b>标题:</b> ${post.title}
<b>作者:</b> ${post.creator}
<b>分类:</b> ${post.category}
<b>匹配关键词:</b> ${matchedKeywords.join(', ')}

<b>摘要:</b> ${post.memo.substring(0, 200)}${post.memo.length > 200 ? '...' : ''}

<b>发布时间:</b> ${new Date(post.pub_date).toLocaleString()}
`;

    return await this.sendMessage(config.chat_id, message);
  }
}