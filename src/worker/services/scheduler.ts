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

  async processRSSFeed(): Promise<{ processed: number; matched: number; errors: string[]; duration: number }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let matched = 0;

    console.log('开始处理 RSS 订阅...');

    try {
      // 获取配置
      const config = await this.db.getBaseConfig();
      if (!config) {
        const error = '系统未初始化';
        errors.push(error);
        console.error(error);
        return { processed, matched, errors, duration: Date.now() - startTime };
      }

      console.log(`配置信息: 推送状态=${config.stop_push ? '停止' : '正常'}, 匹配模式=${config.only_title ? '仅标题' : '标题+内容'}`);

      // 获取订阅
      const subs = await this.db.getKeywordSubs();
      if (subs.length === 0) {
        const error = '无有效订阅规则';
        errors.push(error);
        console.warn(error);
        return { processed, matched, errors, duration: Date.now() - startTime };
      }

      console.log(`找到 ${subs.length} 个订阅规则`);

      // 获取 RSS 数据
      console.log('开始获取 RSS 数据...');
      const rssItems = await this.rssService.fetchRSS();
      console.log(`获取到 ${rssItems.length} 条 RSS 数据`);

      if (rssItems.length === 0) {
        const error = '未获取到 RSS 数据';
        errors.push(error);
        console.warn(error);
        return { processed, matched, errors, duration: Date.now() - startTime };
      }
      
      // 处理每个 RSS 项目
      for (const item of rssItems) {
        try {
          // 验证 RSS 项目
          if (!this.rssService.validateRSSItem(item)) {
            errors.push(`RSS 项目数据不完整: ${item.title || '未知标题'}`);
            continue;
          }

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

          console.log(`处理新文章: ${item.title} (ID: ${postId})`);

          // 创建新文章记录
          const post = await this.db.createPost({
            post_id: postId,
            title: item.title,
            memo: item.description,
            category: item.category || '默认分类',
            creator: item.creator || '未知作者',
            push_status: 0, // 默认未推送
            pub_date: item.pubDate,
          });

          processed++;

          // 检查是否匹配订阅规则
          const matchResult = MatcherService.matchPost(post, subs, config);
          
          if (matchResult.matched) {
            matched++;
            console.log(`文章匹配成功: ${post.title}, 关键词: ${matchResult.matchedKeywords.join(', ')}`);
            
            // 检查是否需要推送
            if (config.bot_token && !config.stop_push && config.chat_id) {
              console.log('发送 Telegram 通知...');
              
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
                console.log('推送成功');
              } else {
                const error = `推送失败: ${post.title}`;
                errors.push(error);
                console.error(error);
                
                // 标记推送失败，但保持状态为未推送以便重试
                await this.db.updatePostPushStatus(postId, 0);
              }
            } else {
              // 推送被禁用或未配置
              await this.db.updatePostPushStatus(postId, 2); // 无需推送
              
              if (!config.bot_token) {
                console.log('Telegram Bot 未配置，跳过推送');
              } else if (config.stop_push) {
                console.log('推送已停止，跳过推送');
              } else if (!config.chat_id) {
                console.log('Chat ID 未配置，跳过推送');
              }
            }
          } else {
            // 不匹配任何订阅规则
            await this.db.updatePostPushStatus(postId, 2); // 无需推送
            console.log(`文章不匹配任何订阅: ${post.title}`);
          }

        } catch (error) {
          const errorMessage = `处理文章失败: ${item.title || '未知标题'} - ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMessage);
          console.error(errorMessage, error);
        }
      }

    } catch (error) {
      const errorMessage = `RSS 处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMessage);
      console.error(errorMessage, error);
    }

    const duration = Date.now() - startTime;
    console.log(`RSS 处理完成: 处理=${processed}, 匹配=${matched}, 错误=${errors.length}, 耗时=${duration}ms`);

    return { processed, matched, errors, duration };
  }


}