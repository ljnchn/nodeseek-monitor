import { Database } from '../db/database';
import { RSSService } from './rss';
import { TelegramService } from './telegram';
import { MatcherService } from './matcher';

export class SchedulerService {
  constructor(
    private db: Database,
    private rssService: RSSService,
    private telegramService: TelegramService
  ) {}

  async processRSSFeed(): Promise<{ processed: number; matched: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;
    let matched = 0;

    try {
      // 获取配置
      const config = await this.db.getBaseConfig();
      if (!config) {
        errors.push('系统未初始化');
        return { processed, matched, errors };
      }

      // 获取订阅
      const subs = await this.db.getKeywordSubs();
      if (subs.length === 0) {
        errors.push('无订阅规则');
        return { processed, matched, errors };
      }

      // 获取 RSS 数据
      const rssItems = await this.rssService.fetchRSS();
      
      for (const item of rssItems) {
        try {
          const postId = this.rssService.extractPostId(item.link);
          if (!postId) {
            errors.push(`无法提取文章ID: ${item.link}`);
            continue;
          }

          // 检查是否已存在
          const existingPost = await this.db.getPostByPostId(postId);
          if (existingPost) {
            continue; // 跳过已存在的文章
          }

          // 创建新文章记录
          const post = await this.db.createPost({
            post_id: postId,
            title: item.title,
            memo: item.description,
            category: item.category,
            creator: item.creator,
            push_status: 0, // 默认未推送
            pub_date: new Date(item.pubDate).toISOString(),
          });

          processed++;

          // 检查是否匹配订阅规则
          const matchResult = MatcherService.matchPost(post, subs, config);
          
          if (matchResult.matched) {
            matched++;
            
            // 发送通知
            if (config.bot_token && !config.stop_push) {
              const success = await this.telegramService.sendPostNotification(
                post, 
                matchResult.matchedKeywords
              );
              
              if (success) {
                await this.db.updatePostPushStatus(
                  postId, 
                  1, // 已推送
                  new Date().toISOString(),
                  matchResult.subId
                );
              } else {
                errors.push(`推送失败: ${post.title}`);
              }
            } else {
              // 标记为无需推送
              await this.db.updatePostPushStatus(postId, 2);
            }
          } else {
            // 标记为无需推送
            await this.db.updatePostPushStatus(postId, 2);
          }

        } catch (error) {
          errors.push(`处理文章失败: ${item.title} - ${error}`);
        }
      }

    } catch (error) {
      errors.push(`RSS 处理失败: ${error}`);
    }

    return { processed, matched, errors };
  }
}