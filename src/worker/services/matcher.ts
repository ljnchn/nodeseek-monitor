import { Post, KeywordSub, BaseConfig } from '../db/types';

export class MatcherService {
  static matchPost(post: Post, subs: KeywordSub[], config: BaseConfig): { matched: boolean; matchedKeywords: string[]; subId?: number } {
    const matchedKeywords: string[] = [];
    let matchedSubId: number | undefined;

    for (const sub of subs) {
      const keywords = [sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean) as string[];
      const isMatch = this.checkKeywordMatch(post, keywords, config.only_title === 1);
      
      if (isMatch) {
        // 检查创建者和分类过滤
        if (sub.creator && !this.matchCreator(post.creator, sub.creator)) continue;
        if (sub.category && !this.matchCategory(post.category, sub.category)) continue;

        matchedKeywords.push(...keywords);
        matchedSubId = sub.id;
        break; // 找到第一个匹配的订阅就停止
      }
    }

    return {
      matched: matchedKeywords.length > 0,
      matchedKeywords: this.removeDuplicates(matchedKeywords),
      subId: matchedSubId
    };
  }

  private static checkKeywordMatch(post: Post, keywords: string[], onlyTitle: boolean): boolean {
    const searchText = onlyTitle ? post.title : `${post.title} ${post.memo}`;
    const normalizedSearchText = this.normalizeText(searchText);

    // 所有关键词都必须匹配（AND 逻辑）
    return keywords.every(keyword => {
      const normalizedKeyword = this.normalizeText(keyword);
      return this.containsKeyword(normalizedSearchText, normalizedKeyword);
    });
  }

  private static containsKeyword(text: string, keyword: string): boolean {
    // 精确匹配
    if (text.includes(keyword)) {
      return true;
    }

    // 分词匹配（支持中文分词）
    return this.segmentMatch(text, keyword);
  }

  private static segmentMatch(text: string, keyword: string): boolean {
    // 简单的中文分词匹配
    const keywordChars = keyword.split('');
    let lastIndex = -1;
    
    for (const char of keywordChars) {
      const index = text.indexOf(char, lastIndex + 1);
      if (index === -1) return false;
      lastIndex = index;
    }
    
    return true;
  }

  private static matchCreator(postCreator: string, filterCreator: string): boolean {
    const normalizedPost = this.normalizeText(postCreator);
    const normalizedFilter = this.normalizeText(filterCreator);
    
    // 支持部分匹配和精确匹配
    return normalizedPost.includes(normalizedFilter) || normalizedFilter.includes(normalizedPost);
  }

  private static matchCategory(postCategory: string, filterCategory: string): boolean {
    const normalizedPost = this.normalizeText(postCategory);
    const normalizedFilter = this.normalizeText(filterCategory);
    
    // 支持部分匹配和精确匹配
    return normalizedPost.includes(normalizedFilter) || normalizedFilter.includes(normalizedPost);
  }

  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^\w\u4e00-\u9fff]/g, '') // 保留字母、数字和中文字符
      .trim();
  }

  private static removeDuplicates(array: string[]): string[] {
    return [...new Set(array)];
  }

  // 获取匹配统计信息
  static getMatchStats(posts: Post[], subs: KeywordSub[], config: BaseConfig): {
    totalPosts: number;
    matchedPosts: number;
    unmatchedPosts: number;
    matchRate: number;
    topKeywords: { keyword: string; count: number }[];
  } {
    let matchedCount = 0;
    const keywordCounts = new Map<string, number>();

    for (const post of posts) {
      const result = this.matchPost(post, subs, config);
      if (result.matched) {
        matchedCount++;
        result.matchedKeywords.forEach(keyword => {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        });
      }
    }

    const topKeywords = Array.from(keywordCounts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPosts: posts.length,
      matchedPosts: matchedCount,
      unmatchedPosts: posts.length - matchedCount,
      matchRate: posts.length > 0 ? (matchedCount / posts.length) * 100 : 0,
      topKeywords
    };
  }

  // 验证关键词有效性
  static validateKeywords(keywords: (string | undefined)[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const validKeywords = keywords.filter(Boolean) as string[];

    if (validKeywords.length === 0) {
      errors.push('至少需要一个关键词');
    }

    for (const keyword of validKeywords) {
      if (keyword.trim().length < 2) {
        errors.push(`关键词 "${keyword}" 长度不能少于2个字符`);
      }
      if (keyword.length > 50) {
        errors.push(`关键词 "${keyword}" 长度不能超过50个字符`);
      }
      if (!/^[\w\u4e00-\u9fff\s\-_.]+$/.test(keyword)) {
        errors.push(`关键词 "${keyword}" 包含无效字符`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}