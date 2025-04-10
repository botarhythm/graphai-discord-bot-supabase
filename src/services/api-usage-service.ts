/**
 * API使用量追跡サービス
 */

import supabase from '../db/supabase';

// サービスタイプの定義
type ServiceType = 'gemini' | 'brave' | 'recraft';

const ApiUsageService = {
  /**
   * API使用回数を記録する
   * @param service サービス名
   * @returns 成功したかどうか
   */
  async trackApiUsage(service: ServiceType): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 当日の使用量レコードを検索
      const { data, error } = await supabase
        .from('api_usage')
        .select('id, request_count')
        .eq('service', service)
        .eq('date', today)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116: No rows returned
        console.error('Error fetching API usage:', error);
        return false;
      }
      
      if (data) {
        // 既存レコードの更新
        const { error: updateError } = await supabase
          .from('api_usage')
          .update({
            request_count: data.request_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id);
        
        if (updateError) {
          console.error('Error updating API usage:', updateError);
          return false;
        }
      } else {
        // 新規レコードの作成
        const { error: insertError } = await supabase
          .from('api_usage')
          .insert({
            service,
            request_count: 1,
            date: today
          });
        
        if (insertError) {
          console.error('Error inserting API usage:', insertError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error tracking API usage:', error);
      return false;
    }
  },
  
  /**
   * 当日のAPI使用回数を取得する
   * @param service サービス名
   * @returns 使用回数
   */
  async getDailyUsage(service: ServiceType): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('api_usage')
        .select('request_count')
        .eq('service', service)
        .eq('date', today)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching daily API usage:', error);
        return 0;
      }
      
      return data?.request_count || 0;
    } catch (error) {
      console.error('Error getting daily API usage:', error);
      return 0;
    }
  },
  
  /**
   * 日別の使用量サマリーを取得する
   * @param service サービス名
   * @param days 取得する日数
   * @returns 日別使用量の配列
   */
  async getUsageSummary(service: ServiceType, days: number = 7): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('api_usage')
        .select('date, request_count')
        .eq('service', service)
        .order('date', { ascending: false })
        .limit(days);
      
      if (error) {
        console.error('Error fetching API usage summary:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error getting API usage summary:', error);
      return [];
    }
  }
};

export default ApiUsageService;
