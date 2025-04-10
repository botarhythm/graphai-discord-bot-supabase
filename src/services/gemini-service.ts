/**
 * Gemini API統合サービス
 * Google Gemini AIの統合と利用状態の管理
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import ApiUsageService from './api-usage-service';
import BotSettingsService from './bot-settings-service';
import supabase from '../db/supabase';

// インターフェース定義
export interface GeminiModelConfig {
  model: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiSettings {
  modelName: string;
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
  safetySettings: {
    category: string;
    threshold: string;
  }[];
}

// Gemini統合サービス
const GeminiService = {
  /**
   * Gemini APIクライアントの初期化
   * @returns Gemini API生成モデル
   */
  async getModel() {
    try {
      // APIキーの取得
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables');
      }
      
      // Gemini設定の取得
      const settings = await this.getGeminiSettings();
      
      // Gemini APIクライアントの初期化
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // モデル設定
      const modelConfig: GeminiModelConfig = {
        model: settings.modelName,
        temperature: settings.temperature,
        topK: settings.topK,
        topP: settings.topP,
        maxOutputTokens: settings.maxOutputTokens
      };
      
      return genAI.getGenerativeModel(modelConfig);
    } catch (error) {
      console.error('Error initializing Gemini model:', error);
      throw error;
    }
  },
  
  /**
   * チャットセッションの開始
   * @param history 履歴メッセージ
   * @returns チャットセッション
   */
  async startChat(history: any[] = []) {
    try {
      const model = await this.getModel();
      const settings = await this.getGeminiSettings();
      
      // 履歴フォーマットの変換（必要に応じて）
      const formattedHistory = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      
      // 安全設定の変換
      const safetySettings = settings.safetySettings.map(setting => ({
        category: setting.category as HarmCategory,
        threshold: setting.threshold as HarmBlockThreshold
      }));
      
      // チャットの初期化
      return model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: settings.temperature,
          topK: settings.topK,
          topP: settings.topP,
          maxOutputTokens: settings.maxOutputTokens,
        },
        safetySettings
      });
    } catch (error) {
      console.error('Error starting Gemini chat:', error);
      throw error;
    }
  },
  
  /**
   * メッセージ送信のロガーとトラッカー
   * @param userId ユーザーID
   * @param content メッセージ内容
   * @returns 追跡成功の可否
   */
  async trackMessageSent(userId: string, content: string): Promise<boolean> {
    try {
      // API使用量を追跡
      await ApiUsageService.trackApiUsage('gemini');
      
      // 使用状況をログに記録
      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from('api_logs')
        .insert({
          service: 'gemini',
          user_id: userId,
          request_type: 'text',
          characters_count: content.length,
          timestamp
        });
      
      if (error) {
        console.warn('Failed to log Gemini API usage:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error tracking Gemini message:', error);
      return false;
    }
  },
  
  /**
   * Gemini APIの日次使用制限をチェック
   * @returns 制限に達しているかどうか
   */
  async checkUsageLimit(): Promise<boolean> {
    try {
      // 日々の制限を確認
      const dailyLimit = await BotSettingsService.getApiLimit('gemini');
      const dailyUsage = await ApiUsageService.getDailyUsage('gemini');
      
      // 制限に達しているかどうか
      return dailyUsage < dailyLimit;
    } catch (error) {
      console.error('Error checking Gemini usage limit:', error);
      return false; // エラー時は制限に達していると仮定
    }
  },
  
  /**
   * Gemini設定を取得
   * @returns Gemini設定
   */
  async getGeminiSettings(): Promise<GeminiSettings> {
    try {
      // データベースから設定を取得
      const settings = await BotSettingsService.getSetting('gemini_settings');
      
      // 設定が存在する場合はそれを返す
      if (settings) {
        return settings;
      }
      
      // デフォルト設定
      const defaultSettings: GeminiSettings = {
        modelName: 'gemini-pro',
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      };
      
      // デフォルト設定をデータベースに保存
      await BotSettingsService.updateSetting('gemini_settings', defaultSettings);
      
      return defaultSettings;
    } catch (error) {
      console.error('Error getting Gemini settings:', error);
      
      // 最低限の設定を返す
      return {
        modelName: 'gemini-pro',
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        safetySettings: []
      };
    }
  },
  
  /**
   * Gemini設定を更新
   * @param settings 更新する設定
   * @returns 更新成功の可否
   */
  async updateGeminiSettings(settings: Partial<GeminiSettings>): Promise<boolean> {
    try {
      // 現在の設定を取得
      const currentSettings = await this.getGeminiSettings();
      
      // 更新された設定を作成
      const updatedSettings = {
        ...currentSettings,
        ...settings
      };
      
      // データベースに保存
      return await BotSettingsService.updateSetting('gemini_settings', updatedSettings);
    } catch (error) {
      console.error('Error updating Gemini settings:', error);
      return false;
    }
  }
};

export default GeminiService;
