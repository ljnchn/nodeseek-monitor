export interface BaseConfig {
  id?: number;
  username: string;
  password: string;
  bot_token?: string;
  chat_id: string;
  stop_push: number;
  only_title: number;
  created_at?: string;
  updated_at?: string;
}

export interface Post {
  id?: number;
  post_id: number;
  title: string;
  memo: string;
  category: string;
  creator: string;
  push_status: number; // 0 未推送 1 已推送 2 无需推送
  sub_id?: number;
  pub_date: string;
  push_date?: string;
  created_at?: string;
}

export interface KeywordSub {
  id?: number;
  keyword1: string;
  keyword2?: string;
  keyword3?: string;
  creator?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  creator: string;
  category: string;
}