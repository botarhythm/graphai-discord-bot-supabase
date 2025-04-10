/**
 * ボット設定サービス
 */

import supabase from '../db/supabase';

const BotSettingsService = {
  /**
   * 設定値を取得する
   * @param key 設定キー
   * @returns 設定オブジェクト
   */
  async getSetting(key: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('bot_settings')
        .select('value')
        .eq('key', key)
        .single();
      
      if (error) {
        console.error(`Error getting setting for key ${key}:`, error);
        return null;
      }
      
      return data?.value;
    } catch (error) {
      console.error(`Error retrieving setting for key ${key}:`, error);
      return null;
    }
  },
  
  /**
   * 設定値を更新する
   * @param key 設定キー
   * @param value 設定値
   * @returns 成功したかどうか
   */
  async updateSetting(key: string, value: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bot_settings')
        .upsert(
          {
            key,
            value,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'key'
          }
        );
      
      if (error) {
        console.error(`Error updating setting for key ${key}:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`Error saving setting for key ${key}:`, error);
      return false;
    }
  },
  
  /**
   * システムプロンプトテンプレートを取得する
   * @returns システムプロンプトテンプレート
   */
  async getSystemPrompt(): Promise<string> {
    try {
      const promptTemplate = await this.getSetting('prompt_template');
      
      if (!promptTemplate || !promptTemplate.system_prompt) {
        // デフォルトのプロンプトを返す
        return `あなたは「ボッチー」という名前のDiscord上で動作するAIアシスタントです。
以下の特徴と制約を持っています：

- 親しみやすく、フレンドリーな雰囲気を持ち、時々ユーモアを交えた会話をします
- 簡潔で分かりやすい日本語で回答します
- 専門的な話題でも理解しやすい説明を心がけます
- 質問に対して具体的かつ役立つ情報を提供します
- クリエイティブな質問にも柔軟に対応します
- 不適切なリクエストには丁寧に断ります

現在の日付: ${new Date().toISOString().split('T')[0]}`;
      }
      
      // 現在の日付を追加
      return `${promptTemplate.system_prompt}

現在の日付: ${new Date().toISOString().split('T')[0]}`;
    } catch (error) {
      console.error('Error retrieving system prompt:', error);
      return '';
    }
  },
  
  /**
   * API制限を取得する
   * @param service サービス名
   * @returns 日次制限値
   */
  async getApiLimit(service: string): Promise<number> {
    try {
      const apiLimits = await this.getSetting('api_limits');
      
      if (!apiLimits || !apiLimits[service] || !apiLimits[service].daily) {
        // デフォルト値
        const defaults = {
          gemini: 50000,
          brave: 1000,
          recraft: 50
        };
        
        return defaults[service as keyof typeof defaults] || 0;
      }
      
      return apiLimits[service].daily;
    } catch (error) {
      console.error(`Error retrieving API limit for ${service}:`, error);
      return 0;
    }
  },
  
  /**
   * ボット設定を取得する
   * @returns ボット設定オブジェクト
   */
  async getBotConfig(): Promise<any> {
    try {
      const botConfig = await this.getSetting('bot_config');
      
      if (!botConfig) {
        // デフォルト設定
        return {
          prefix: '!',
          allow_all_servers: false,
          debug_mode: false
        };
      }
      
      return botConfig;
    } catch (error) {
      console.error('Error retrieving bot config:', error);
      return {
        prefix: '!',
        allow_all_servers: false,
        debug_mode: false
      };
    }
  }
};

export default BotSettingsService;
