/**
 * 会話履歴管理サービス (Supabase版)
 */

import supabase from '../db/supabase';

// 会話メッセージの型定義
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const ConversationService = {
  /**
   * 会話履歴を取得する
   * @param userId ユーザーID
   * @returns 会話履歴の配列
   */
  async getConversationHistory(userId: string): Promise<ConversationMessage[]> {
    try {
      // ユーザーIDで会話履歴を検索
      const { data, error } = await supabase
        .from('conversation_histories')
        .select('content')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.log('Conversation history not found for user:', userId);
        return [];
      }
      
      return data?.content as ConversationMessage[] || [];
    } catch (error) {
      console.error('Error retrieving conversation history:', error);
      return [];
    }
  },
  
  /**
   * 会話履歴を保存する
   * @param userId ユーザーID
   * @param history 会話履歴の配列
   */
  async saveConversationHistory(userId: string, history: ConversationMessage[]): Promise<void> {
    try {
      // 最新の10件のみ保存（コンテキストウィンドウの制限のため）
      const recentHistory = history.slice(-10);
      
      // Upsert操作 - 存在すれば更新、なければ作成
      const { error } = await supabase
        .from('conversation_histories')
        .upsert(
          {
            user_id: userId,
            content: recentHistory,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id'
          }
        );
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving conversation history:', error);
    }
  },
  
  /**
   * 会話履歴をクリアする
   * @param userId ユーザーID
   * @returns 成功したかどうか
   */
  async clearConversationHistory(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversation_histories')
        .upsert(
          {
            user_id: userId,
            content: [],
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id'
          }
        );
      
      return !error;
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      return false;
    }
  }
};

export default ConversationService;
