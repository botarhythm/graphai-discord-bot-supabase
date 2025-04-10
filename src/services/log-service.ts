/**
 * ログサービス
 * アプリケーション全体のログ管理と分析機能を提供
 */

import fs from 'fs/promises';
import path from 'path';
import supabase from '../db/supabase';

// ログレベルタイプ
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ログカテゴリタイプ
export type LogCategory = 
  | 'system'       // システム全般
  | 'discord'      // Discord関連
  | 'database'     // データベース関連
  | 'ai'           // AI処理関連
  | 'security'     // セキュリティ関連
  | 'performance'  // パフォーマンス関連
  | 'api'          // 外部API関連
  | 'user';        // ユーザー関連

// ログエントリインターフェース
export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  timestamp: string;
  context?: string;
}

// ログ設定インターフェース
interface LogConfig {
  enableConsole: boolean;
  enableDatabase: boolean;
  enableFile: boolean;
  logLevel: LogLevel;
  logDirectory: string;
  maxLogAge: number; // 日数
  maxLogSize: number; // バイト
  includeCategories: LogCategory[];
}

// ログサービスの実装
const LogService = {
  // デフォルト設定
  config: {
    enableConsole: true,
    enableDatabase: true,
    enableFile: true,
    logLevel: 'info' as LogLevel,
    logDirectory: 'logs',
    maxLogAge: 30, // 30日
    maxLogSize: 10 * 1024 * 1024, // 10MB
    includeCategories: ['system', 'discord', 'database', 'ai', 'security', 'performance', 'api', 'user'] as LogCategory[]
  } as LogConfig,

  /**
   * ログサービスの初期化
   * @param config 設定オブジェクト（オプション）
   */
  async initialize(config?: Partial<LogConfig>): Promise<void> {
    try {
      // 設定のマージ
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // データベースにログテーブルが存在するか確認
      if (this.config.enableDatabase) {
        await this.ensureLogTableExists();
      }

      // ログディレクトリの作成
      if (this.config.enableFile) {
        await this.ensureLogDirectoryExists();
      }

      // 古いログファイルのクリーンアップ
      await this.cleanupOldLogs();

      this.log('info', 'system', 'ログサービスが初期化されました', { config: this.config });
    } catch (error) {
      console.error('ログサービスの初期化中にエラーが発生しました:', error);
      
      // 最低限のログ機能を有効化
      this.config.enableConsole = true;
      this.config.enableDatabase = false;
      this.config.enableFile = false;
    }
  },

  /**
   * ログを記録
   * @param level ログレベル
   * @param category ログカテゴリ
   * @param message ログメッセージ
   * @param details 詳細情報（オプション）
   * @param context コンテキスト情報（オプション）
   */
  async log(level: LogLevel, category: LogCategory, message: string, details?: any, context?: string): Promise<void> {
    // ログレベルと設定のチェック
    if (!this.shouldLog(level, category)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      level,
      category,
      message,
      details,
      timestamp,
      context
    };

    // コンソールへの出力
    if (this.config.enableConsole) {
      await this.logToConsole(logEntry);
    }

    // データベースへの保存
    if (this.config.enableDatabase) {
      await this.logToDatabase(logEntry);
    }

    // ファイルへの保存
    if (this.config.enableFile) {
      await this.logToFile(logEntry);
    }
  },

  /**
   * デバッグログ
   */
  async debug(category: LogCategory, message: string, details?: any, context?: string): Promise<void> {
    return this.log('debug', category, message, details, context);
  },

  /**
   * 情報ログ
   */
  async info(category: LogCategory, message: string, details?: any, context?: string): Promise<void> {
    return this.log('info', category, message, details, context);
  },

  /**
   * 警告ログ
   */
  async warn(category: LogCategory, message: string, details?: any, context?: string): Promise<void> {
    return this.log('warn', category, message, details, context);
  },

  /**
   * エラーログ
   */
  async error(category: LogCategory, message: string, details?: any, context?: string): Promise<void> {
    return this.log('error', category, message, details, context);
  },

  /**
   * 致命的エラーログ
   */
  async fatal(category: LogCategory, message: string, details?: any, context?: string): Promise<void> {
    return this.log('fatal', category, message, details, context);
  },

  /**
   * ログを記録すべきかを判断
   */
  shouldLog(level: LogLevel, category: LogCategory): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const currentLevelIndex = levels.indexOf(level);

    // ログレベルがconfig以上か、カテゴリが含まれているか
    return currentLevelIndex >= configLevelIndex && this.config.includeCategories.includes(category);
  },

  /**
   * コンソールにログを出力
   */
  async logToConsole(logEntry: LogEntry): Promise<void> {
    const { level, category, message, details, timestamp } = logEntry;
    const formattedTimestamp = timestamp.slice(0, 19).replace('T', ' ');
    
    // ログレベルに応じた色とコンソールメソッドの選択
    let logMethod = console.log;
    let colorCode = '\x1b[0m'; // デフォルト (リセット)
    
    switch (level) {
      case 'debug':
        colorCode = '\x1b[90m'; // グレー
        break;
      case 'info':
        colorCode = '\x1b[36m'; // シアン
        break;
      case 'warn':
        colorCode = '\x1b[33m'; // 黄色
        logMethod = console.warn;
        break;
      case 'error':
        colorCode = '\x1b[31m'; // 赤
        logMethod = console.error;
        break;
      case 'fatal':
        colorCode = '\x1b[35m'; // マゼンタ
        logMethod = console.error;
        break;
    }
    
    // 基本情報を出力
    logMethod(`${colorCode}[${formattedTimestamp}] [${level.toUpperCase()}] [${category}] ${message}\x1b[0m`);
    
    // 詳細情報があれば出力
    if (details) {
      try {
        // オブジェクトを整形して出力
        logMethod(colorCode, typeof details === 'object' ? JSON.stringify(details, null, 2) : details, '\x1b[0m');
      } catch (error) {
        logMethod(`${colorCode}[詳細情報の表示に失敗しました: ${error}]\x1b[0m`);
      }
    }
  },

  /**
   * データベースにログを保存
   */
  async logToDatabase(logEntry: LogEntry): Promise<void> {
    try {
      const { level, category, message, details, timestamp, context } = logEntry;
      
      const { error } = await supabase
        .from('system_logs')
        .insert({
          level,
          category,
          message,
          details: details ? JSON.stringify(details) : null,
          timestamp,
          context
        });
        
      if (error) {
        console.error('ログのデータベース保存中にエラーが発生:', error);
      }
    } catch (error) {
      console.error('ログのデータベース保存中に例外が発生:', error);
    }
  },

  /**
   * ファイルにログを保存
   */
  async logToFile(logEntry: LogEntry): Promise<void> {
    try {
      const { level, category, message, details, timestamp } = logEntry;
      const formattedTimestamp = timestamp.slice(0, 19).replace('T', ' ');
      
      // ログフォーマットの生成
      let logLine = `[${formattedTimestamp}] [${level.toUpperCase()}] [${category}] ${message}`;
      
      // 詳細情報があれば追加
      if (details) {
        try {
          logLine += `\n${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}`;
        } catch (error) {
          logLine += `\n[詳細情報の表示に失敗しました: ${error}]`;
        }
      }
      
      logLine += '\n';
      
      // 日付ベースのファイル名
      const today = new Date().toISOString().split('T')[0];
      const logFilePath = path.join(this.config.logDirectory, `${today}.log`);
      
      // ファイルに追記
      await fs.appendFile(logFilePath, logLine);
      
      // ファイルサイズを確認し、必要に応じてローテーション
      await this.rotateLogFileIfNeeded(logFilePath);
    } catch (error) {
      console.error('ログのファイル保存中にエラーが発生:', error);
    }
  },

  /**
   * ログファイルのローテーション
   */
  async rotateLogFileIfNeeded(logFilePath: string): Promise<void> {
    try {
      const stats = await fs.stat(logFilePath);
      
      // ファイルサイズが閾値を超えた場合
      if (stats.size > this.config.maxLogSize) {
        const rotationTimestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const newFilePath = `${logFilePath}.${rotationTimestamp}`;
        
        // ファイルの名前を変更
        await fs.rename(logFilePath, newFilePath);
        
        // 空の新しいログファイルを作成
        await fs.writeFile(logFilePath, '');
        
        console.log(`ログファイルをローテーションしました: ${newFilePath}`);
      }
    } catch (error) {
      console.error('ログファイルのローテーション中にエラーが発生:', error);
    }
  },

  /**
   * ログディレクトリの存在を確認し、必要に応じて作成
   */
  async ensureLogDirectoryExists(): Promise<void> {
    try {
      // ディレクトリが存在するか確認
      await fs.access(this.config.logDirectory);
    } catch (error) {
      // ディレクトリが存在しない場合は作成
      try {
        await fs.mkdir(this.config.logDirectory, { recursive: true });
        console.log(`ログディレクトリを作成しました: ${this.config.logDirectory}`);
      } catch (mkdirError) {
        console.error('ログディレクトリの作成中にエラーが発生:', mkdirError);
        throw mkdirError;
      }
    }
  },

  /**
   * ログテーブルの存在を確認し、必要に応じて作成
   */
  async ensureLogTableExists(): Promise<void> {
    try {
      // テーブルが存在するか確認
      const { error: checkError } = await supabase.rpc('check_table_exists', { table_name: 'system_logs' });
      
      if (checkError) {
        console.log('system_logsテーブルが存在しないため、作成します');
        
        // テーブルを作成するSQL
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS system_logs (
            id SERIAL PRIMARY KEY,
            level TEXT NOT NULL,
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            details JSONB,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            context TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          
          -- インデックスの作成
          CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
          CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
          CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
        `;
        
        // SQLを実行
        const { error: createError } = await supabase.rpc('execute_sql', { sql: createTableSQL });
        
        if (createError) {
          console.error('system_logsテーブル作成に失敗しました:', createError.message);
          throw createError;
        }
        
        console.log('system_logsテーブルを作成しました');
      }
    } catch (error) {
      console.error('ログテーブルの確認・作成中にエラーが発生:', error);
      throw error;
    }
  },

  /**
   * 古いログファイルをクリーンアップ
   */
  async cleanupOldLogs(): Promise<void> {
    try {
      // ログファイルの一覧を取得
      const files = await fs.readdir(this.config.logDirectory);
      const now = new Date();
      
      for (const file of files) {
        // 拡張子が.logのファイルのみ処理
        if (path.extname(file) === '.log' || file.includes('.log.')) {
          const filePath = path.join(this.config.logDirectory, file);
          const stats = await fs.stat(filePath);
          
          // ファイルの最終更新日を取得
          const fileDate = new Date(stats.mtime);
          
          // 設定された日数より古いファイルを削除
          const ageDays = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (ageDays > this.config.maxLogAge) {
            await fs.unlink(filePath);
            console.log(`古いログファイルを削除しました: ${filePath}`);
          }
        }
      }
    } catch (error) {
      console.error('古いログファイルのクリーンアップ中にエラーが発生:', error);
    }
  },

  /**
   * データベースの古いログをクリーンアップ
   */
  async cleanupDatabaseLogs(): Promise<void> {
    try {
      // 設定された日数より古いログを削除
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.maxLogAge);
      
      const { error } = await supabase
        .from('system_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());
        
      if (error) {
        console.error('データベースの古いログの削除中にエラーが発生:', error);
      } else {
        console.log(`${this.config.maxLogAge}日より古いデータベースログをクリーンアップしました`);
      }
    } catch (error) {
      console.error('データベースログのクリーンアップ中に例外が発生:', error);
    }
  },

  /**
   * ログの検索
   */
  async searchLogs(options: {
    level?: LogLevel;
    category?: LogCategory;
    startDate?: Date;
    endDate?: Date;
    searchText?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const { level, category, startDate, endDate, searchText, limit = 100, offset = 0 } = options;
      
      // クエリビルダー
      let query = supabase
        .from('system_logs')
        .select('*');
        
      // 条件の適用
      if (level) {
        query = query.eq('level', level);
      }
      
      if (category) {
        query = query.eq('category', category);
      }
      
      if (startDate) {
        query = query.gte('timestamp', startDate.toISOString());
      }
      
      if (endDate) {
        query = query.lte('timestamp', endDate.toISOString());
      }
      
      if (searchText) {
        query = query.ilike('message', `%${searchText}%`);
      }
      
      // ページング
      query = query
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);
        
      const { data, error } = await query;
      
      if (error) {
        console.error('ログの検索中にエラーが発生:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('ログの検索中に例外が発生:', error);
      return [];
    }
  },

  /**
   * ログのサマリーを取得
   */
  async getLogSummary(days: number = 7): Promise<any> {
    try {
      // 指定日数前の日付
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // レベル別のカウント
      const { data: levelCounts, error: levelError } = await supabase
        .from('system_logs')
        .select('level, count(*)')
        .gte('timestamp', startDate.toISOString())
        .group('level');
        
      if (levelError) {
        console.error('ログレベル集計中にエラーが発生:', levelError);
      }
      
      // カテゴリ別のカウント
      const { data: categoryCounts, error: categoryError } = await supabase
        .from('system_logs')
        .select('category, count(*)')
        .gte('timestamp', startDate.toISOString())
        .group('category');
        
      if (categoryError) {
        console.error('ログカテゴリ集計中にエラーが発生:', categoryError);
      }
      
      // 日別のカウント
      const { data: dailyCounts, error: dailyError } = await supabase.rpc('get_daily_log_counts', {
        days_count: days
      });
      
      if (dailyError) {
        console.error('日別ログ集計中にエラーが発生:', dailyError);
      }
      
      return {
        levelCounts: levelCounts || [],
        categoryCounts: categoryCounts || [],
        dailyCounts: dailyCounts || []
      };
    } catch (error) {
      console.error('ログサマリーの取得中に例外が発生:', error);
      return {
        levelCounts: [],
        categoryCounts: [],
        dailyCounts: []
      };
    }
  }
};

export default LogService;
