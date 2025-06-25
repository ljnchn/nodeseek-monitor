import { RSSItem } from '../db/types';

export class RSSService {
  private readonly RSS_URL = 'https://www.nodeseek.com/api/feed';

  async fetchRSS(): Promise<RSSItem[]> {
    try {
      console.log('开始获取 NodeSeek RSS 数据...');
      
      const response = await fetch(this.RSS_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`RSS 获取失败: HTTP ${response.status} - ${response.statusText}`);
      }

      const xmlText = await response.text();
      console.log('RSS 数据获取成功，开始解析...');
      
      const items = this.parseRSS(xmlText);
      console.log(`RSS 解析完成，共获取 ${items.length} 条记录`);
      
      return items;
    } catch (error) {
      console.error('RSS 获取失败:', error);
      throw new Error(`RSS 服务错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private parseRSS(xmlText: string): RSSItem[] {
    const items: RSSItem[] = [];
    
    try {
      // 更精确的 XML 解析，支持 NodeSeek 的 RSS 格式
      const itemRegex = /<item\s*>([\s\S]*?)<\/item>/gi;
      let match;

      while ((match = itemRegex.exec(xmlText)) !== null) {
        const itemContent = match[1];
        
        try {
          const title = this.extractTag(itemContent, 'title');
          const description = this.extractTag(itemContent, 'description');
          const link = this.extractTag(itemContent, 'link');
          const pubDate = this.extractTag(itemContent, 'pubDate');
          
          // NodeSeek 特定字段解析
          const creator = this.extractTag(itemContent, 'dc:creator') || 
                         this.extractTag(itemContent, 'author') || 
                         this.extractCreatorFromDescription(description) || 
                         '未知作者';
          
          const category = this.extractTag(itemContent, 'category') || 
                          this.extractCategoryFromDescription(description) || 
                          '默认分类';

          if (title && description && link && pubDate) {
            items.push({
              title: this.cleanText(title),
              description: this.cleanText(description),
              link: this.cleanText(link),
              pubDate: this.normalizeDate(pubDate),
              creator: this.cleanText(creator),
              category: this.cleanText(category)
            });
          }
        } catch (itemError) {
          console.warn('解析单个 RSS 项目失败:', itemError);
          continue; // 跳过错误的项目，继续处理其他项目
        }
      }
    } catch (parseError) {
      console.error('RSS 解析错误:', parseError);
      throw new Error('RSS 格式解析失败');
    }

    return items;
  }

  private extractTag(content: string, tagName: string): string {
    // 支持带命名空间的标签
    const patterns = [
      new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
      new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*${tagName.split(':').pop()}>`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1];
    }
    
    return '';
  }

  private extractCreatorFromDescription(description: string): string {
    // 从描述中提取作者信息的模式
    const patterns = [
      /作者[：:]\s*([^，,\s]+)/,
      /发布者[：:]\s*([^，,\s]+)/,
      /by\s+([^，,\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) return match[1];
    }
    
    return '';
  }

  private extractCategoryFromDescription(description: string): string {
    // 从描述中提取分类信息的模式
    const patterns = [
      /分类[：:]\s*([^，,\s]+)/,
      /类别[：:]\s*([^，,\s]+)/,
      /category[：:]\s*([^，,\s]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) return match[1];
    }
    
    return '';
  }

  private cleanText(text: string): string {
    return text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // 如果日期解析失败，返回当前时间
        console.warn('日期解析失败，使用当前时间:', dateStr);
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  // 从链接中提取 post_id，适配 NodeSeek 的 URL 格式
  extractPostId(link: string): number | null {
    try {
      // NodeSeek 的链接格式: https://www.nodeseek.com/post-{id}-1
      const patterns = [
        /post[_-](\d+)[_-]\d+/i,
        /\/post\/(\d+)/i,
        /\/(\d+)(?:\/|$)/,
        /id[=:](\d+)/i
      ];
      
      for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match) {
          const id = parseInt(match[1], 10);
          if (!isNaN(id) && id > 0) {
            return id;
          }
        }
      }
      
      console.warn('无法从链接中提取 post_id:', link);
      return null;
    } catch (error) {
      console.error('提取 post_id 时出错:', error);
      return null;
    }
  }

  // 验证 RSS 数据有效性
  validateRSSItem(item: RSSItem): boolean {
    const required = ['title', 'description', 'link', 'pubDate'];
    
    for (const field of required) {
      if (!item[field as keyof RSSItem] || item[field as keyof RSSItem].trim() === '') {
        console.warn(`RSS 项目缺少必要字段 ${field}:`, item);
        return false;
      }
    }
    
    return true;
  }
}