export type DbProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_test_user: boolean;
  created_at: string;
  updated_at: string;
};

export type DbUser = {
  id: string;
  email: string;
  created_at: string;
};

export type DbSeason = {
  id: string;
  number: number;
  status: 'active' | 'ended';
  started_at: string;
  ends_at: string;
  duration_seconds: number;
  last_reset_at: string | null;
  created_at: string;
};

export type MessageStatus = 'active' | 'dead' | 'saved' | 'legendary' | 'archived';

export type DbMessage = {
  id: string;
  author_id: string;
  season_id: string;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'gif' | 'video' | null;
  parent_message_id: string | null;
  branch_id: string | null;
  status: MessageStatus;
  survival_count: number;
  reaction_count: number;
  created_at: string;
  died_at: string | null;
  last_survived_at: string | null;
};

export type DbSystemEvent = {
  id: string;
  season_id: string | null;
  kind: 'reset_done' | 'season_warning' | 'season_ended' | 'season_started' | 'custom';
  content: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type DbAttentionSlot = {
  id: string;
  user_id: string;
  message_id: string | null;
  content: string;
  position: number;
  starts_at: string;
  ends_at: string;
  price: number;
  status: 'scheduled' | 'active' | 'expired';
  created_at: string;
  media_url: string | null;
  media_type: 'image' | 'gif' | 'video' | null;
  username?: string | null;
};

export type DbWallet = { user_id: string; balance: number };

export type DbConversation = {
  id: string;
  user_a: string;
  user_b: string;
  last_message: string | null;
  created_at: string;
};

export type DbDirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_by_recipient: boolean;
  created_at: string;
};

/** Единый элемент ленты: пользовательское сообщение или системное событие */
export type FeedItem = {
  type: 'message' | 'system';
  id: string;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'gif' | 'video' | null;
  status: string;
  survival_count?: number;
  reaction_count?: number;
  created_at: string;
  author_id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  branch_id?: string | null;
  repost_of_id?: string | null;
  repost_content?: string | null;
  repost_media_url?: string | null;
  repost_media_type?: 'image' | 'gif' | 'video' | null;
  repost_username?: string | null;
  reply_count?: number;
  repost_count?: number;
  participated?: boolean;
  new_after_me?: number;
  event_kind?: string | null;
};
