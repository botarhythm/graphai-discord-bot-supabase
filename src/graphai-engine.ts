/**
 * GraphAIエンジン（Supabase版）
 */

// Node.js v18未満でも動作するようにBlobのpolyfillをグローバルに追加
import CrossBlob from 'cross-blob';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './config';

// Supabase サービス
import ConversationService, { ConversationMessage } from './services/conversation-service';
import ApiUsageService from './services/api-usage-service';
import BotSettingsService from './services/bot-settings-service';

// Blob polyfill
(globalThis as any).Blob = CrossBlob;

// Web検索と関連エージェントをインポート
import WebSearchAgent from './agents/web-search-agent';
import SearchResultFormatterAgent from './agents/search-result-formatter-agent';
import CommandParserAgent from './agents/command-parser-agent';
import ContentDetectorAgent from './agents/content-detector-agent';

// Gemini AIクライアントの初期化
const genAI = new GoogleGenerativeAI(config.gemini.apiKey as string);
const model = genAI.getGenerativeModel({ model: config.gemini.model });

// エンジン定義
const engine = {
  /**
   * テキスト処理を行う関数
   * @param input 入力パラメータ
   * @returns AIの応答
   */
  async processText(input: { query: string; userId: string; username?: string }): Promise<string> {
    const { query, userId, username = 'ユーザー' } = input;
    
    try {
      // API使用量をトラッキング
      await ApiUsageService.trackApiUsage('gemini');
      
      // 会話履歴の取得
      let history = await ConversationService.getConversationHistory(userId);
      
      // 新しいメッセージを履歴に追加
      history.push({
        role: 'user',
        content: query,
        timestamp: new Date().toISOString()
      });
      
      // システムプロンプトを取得
      const SYSTEM_PROMPT = await BotSettingsService.getSystemPrompt();
      
      // 会話の初期化
      const chat = model.startChat({
        history: history.length > 1 ? history.slice(0, -1).map((msg: ConversationMessage) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })) : [],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
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
      });
      
      // プロンプトの準備
      let prompt = query;
      
      // システムプロンプトを初回の会話のみ追加
      if (history.length <= 1) {
        prompt = `${SYSTEM_PROMPT}\n\nユーザー: ${query}`;
      }
      
      // テキストメッセージの処理
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();
      
      // AIの返答を履歴に追加
      history.push({
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString()
      });
      
      // 会話履歴の保存
      await ConversationService.saveConversationHistory(userId, history);
      
      return text;
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      return `AIモデルとの通信中にエラーが発生しました: ${error.message}`;
    }
  },

  /**
   * ウェブ検索を実行する関数
   * @param query 検索クエリ
   * @returns 検索結果
   */
  async processWebSearch(query: string): Promise<string> {
    console.log('Processing web search for query:', query);
    try {
      // API使用量をトラッキング
      await ApiUsageService.trackApiUsage('brave');
      
      // 日々の制限を確認
      const dailyLimit = await BotSettingsService.getApiLimit('brave');
      const dailyUsage = await ApiUsageService.getDailyUsage('brave');
      
      if (dailyUsage >= dailyLimit) {
        return `申し訳ありませんが、本日のウェブ検索APIの使用量制限(${dailyLimit}回)に達しました。明日以降に再度お試しください。`;
      }
      
      // WebSearchAgentを使用して検索を実行
      const searchResults = await WebSearchAgent.process(query);
      
      // 検索結果をフォーマット
      const formattedResults = await SearchResultFormatterAgent.process(searchResults);
      
      return formattedResults;
    } catch (error: any) {
      console.error('Web search processing error:', error);
      return `ウェブ検索中にエラーが発生しました: ${error.message || error}`;
    }
  },
  
  /**
   * コマンドを解析する関数
   * @param message メッセージ内容
   * @returns 解析結果
   */
  async parseCommand(message: string): Promise<any> {
    try {
      return await CommandParserAgent.process(message);
    } catch (error) {
      console.error('Command parsing error:', error);
      return { command: 'chatDefault', args: message };
    }
  },
  
  /**
   * コンテンツタイプを検出する関数
   * @param message メッセージオブジェクト
   * @returns 検出結果
   */
  async detectContentType(message: any): Promise<any> {
    try {
      return await ContentDetectorAgent.process(message);
    } catch (error) {
      console.error('Content detection error:', error);
      return { hasImage: false, isWebSearchQuery: false };
    }
  },
  
  /**
   * フローを実行する関数（GraphAI代替の簡易実装）
   * @param flowName フロー名
   * @param inputs 入力パラメータ
   * @returns 実行結果
   */
  async execute(flowName: string, inputs: any): Promise<any> {
    console.log(`Executing flow: ${flowName} with inputs:`, inputs);
    
    if (flowName === 'main') {
      // ユーザー入力の処理
      if (inputs.discordInput) {
        // コマンドの解析
        const parsedCommand = await this.parseCommand(inputs.discordInput.content);
        console.log('Parsed command:', parsedCommand);
        
        // コマンドに基づいて処理を分岐
        if (parsedCommand.command === 'webSearch') {
          // Web検索コマンドの処理
          const searchQuery = parsedCommand.args;
          const searchResponse = await this.processWebSearch(searchQuery);
          return {
            discordOutput: searchResponse
          };
        } else if (parsedCommand.command === 'help') {
          // ヘルプコマンドの処理
          return {
            discordOutput: `# ボッチー ヘルプ

こんにちは！ボッチーです。GraphAI技術を活用した会話ボットです。
以下の機能が利用可能です：

**基本コマンド:**
- \`!help\` - このヘルプメッセージを表示します
- \`!search [検索キーワード]\` - ウェブ検索を実行します
- \`/clear\` - 会話履歴をクリアします

**機能:**
- テキスト対話処理 - Gemini 2.0 Flash AIによる自然な会話
- ウェブ検索 - 最新の情報をウェブから検索します
- 画像分析 - 画像に関する質問に答えることができます（近日実装）

GraphAI技術を活用した高度な会話をお楽しみください！`
          };
        } else if (parsedCommand.command === 'clearChat') {
          // 会話履歴クリアコマンドの処理
          const cleared = await ConversationService.clearConversationHistory(inputs.discordInput.authorId);
          return {
            discordOutput: cleared ? 
              '会話履歴をクリアしました。新しい会話を始めましょう！' : 
              '会話履歴のクリアに失敗しました。'
          };
        } else {
          // コンテンツタイプを検出
          const contentType = await this.detectContentType(inputs.discordInput);
          console.log('Detected content type:', contentType);
          
          // ウェブ検索クエリの場合は検索を実行
          if (contentType.isWebSearchQuery) {
            console.log('Detected web search query, performing search...');
            const searchResponse = await this.processWebSearch(inputs.discordInput.content);
            return {
              discordOutput: searchResponse
            };
          }
          
          // 通常のチャットメッセージとして処理
          const response = await this.processText({
            query: inputs.discordInput.content,
            userId: inputs.discordInput.authorId,
            username: inputs.discordInput.username
          });
          
          return {
            discordOutput: response
          };
        }
      }
    } else if (flowName === 'web-search') {
      // ウェブ検索フローの実行
      const searchQuery = inputs.query;
      const searchResults = await this.processWebSearch(searchQuery);
      
      return {
        discordOutput: searchResults
      };
    }
    
    return {
      error: 'Invalid flow or inputs'
    };
  },
  
  /**
   * プロセス関数（TypeScriptからの互換性のため）
   * @param flowName フロー名
   * @param inputs 入力パラメータ
   * @returns 処理結果
   */
  async process(flowName: string, inputs: any): Promise<any> {
    console.log(`Processing flow: ${flowName}`);
    
    // メッセージオブジェクトの形式をdiscordInputに変換
    if (inputs.message) {
      return await this.processText({
        query: inputs.message.content,
        userId: inputs.message.authorId,
        username: inputs.message.username
      });
    }
    
    // 既存のexecuteメソッドにフォールバック
    const result = await this.execute(flowName, inputs);
    
    // discordOutputフィールドがあれば返す
    if (result && result.discordOutput) {
      return result.discordOutput;
    }
    
    return result;
  }
};

console.log('🧠 GraphAI Supabase Engine initialized successfully');

export default engine;
