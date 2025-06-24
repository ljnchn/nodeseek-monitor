import { Post, KeywordSub, BaseConfig } from '../db/types';

export class MatcherService {
  static matchPost(post: Post, subs: KeywordSub[], config: BaseConfig): { matched: boolean; matchedKeywords: string[]; subId?: number } {
    const matchedKeywords: string[] = [];
    let matchedSubId: number | undefined;

    for (const sub of subs) {
      const keywords = [sub.keyword1, sub.keyword2, sub.keyword3].filter(Boolean);
      const isMatch = this.checkKeywordMatch(post, keywords, config.only_title === 1);
      
      if (isMatch) {
        // 检查创建者和分类过滤
        if (sub.creator && post.creator !== sub.creator) continue;
        if (sub.category && post.category !== sub.category) continue;

        matchedKeywords.push(...keywords);
        matchedSubId = sub.id;
        break; // 找到第一个匹配的订阅就停止
      }
    }

    return {
      matched: matchedKeywords.length > 0,
      matchedKeywords,
      subId: matchedSubId
    };
  }

  private static checkKeywordMatch(post: Post, keywords: string[], onlyTitle: boolean): boolean {
    const searchText = onlyTitle ? post.title : `${post.title} ${post.memo}`;
    const lowerSearchText = searchText.toLowerCase();

    // 所有关键词都必须匹配（AND 逻辑）
    return keywords.every(keyword => 
      lowerSearchText.includes(keyword.toLowerCase())
    );
  }
}