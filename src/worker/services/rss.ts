import { RSSItem } from '../db/types';

export class RSSService {
  private readonly RSS_URL = 'https://rss.nodeseek.com/';

  async fetchRSS(): Promise<RSSItem[]> {
    try {
      const response = await fetch(this.RSS_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch RSS: ${response.status}`);
      }

      const xmlText = await response.text();
      return this.parseRSS(xmlText);
    } catch (error) {
      console.error('Error fetching RSS:', error);
      throw error;
    }
  }

  private parseRSS(xmlText: string): RSSItem[] {
    const items: RSSItem[] = [];
    
    // 简单的 XML 解析，提取 item 标签内容
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];
      
      const title = this.extractTag(itemContent, 'title');
      const description = this.extractTag(itemContent, 'description');
      const link = this.extractTag(itemContent, 'link');
      const pubDate = this.extractTag(itemContent, 'pubDate');
      const creator = this.extractTag(itemContent, 'dc:creator') || this.extractTag(itemContent, 'author') || '';
      const category = this.extractTag(itemContent, 'category') || '';

      if (title && description && link && pubDate) {
        items.push({
          title: this.cleanText(title),
          description: this.cleanText(description),
          link: this.cleanText(link),
          pubDate: this.cleanText(pubDate),
          creator: this.cleanText(creator),
          category: this.cleanText(category)
        });
      }
    }

    return items;
  }

  private extractTag(content: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = content.match(regex);
    return match ? match[1] : '';
  }

  private cleanText(text: string): string {
    return text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  // 从链接中提取 post_id
  extractPostId(link: string): number | null {
    const match = link.match(/\/(\d+)(?:\/|$)/);
    return match ? parseInt(match[1], 10) : null;
  }
}