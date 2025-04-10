/**
 * バックアップ・リストアサービス
 * Supabaseデータのエクスポート・インポート機能を提供
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import supabase from '../db/supabase';
import LogService from './log-service';

// バックアップ対象テーブル
const BACKUP_TABLES = [
  'conversation_histories',
  'api_usage',
  'bot_settings',
  'api_logs',
  'system_logs',
  'env_variables',
  'bot_status'
];

// バックアップ対象の重要テーブル（優先度の高いもの）
const CRITICAL_TABLES = [
  'conversation_histories',
  'bot_settings',
  'env_variables'
];

// バックアップメタデータ
interface BackupMetadata {
  timestamp: string;
  version: string;
  tables: string[];
  recordCount: Record<string, number>;
  checksums: Record<string, string>;
  description?: string;
}

// バックアップデータ
interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

// バックアップサービス
const BackupService = {
  // デフォルト設定
  config: {
    backupDirectory: 'backups',
    maxBackupCount: 10,
    autoBackupInterval: 24 * 60 * 60 * 1000, // 24時間（ミリ秒）
    version: '1.0'
  },

  /**
   * バックアップサービスの初期化
   * @param config 設定オブジェクト（オプション）
   */
  async initialize(config?: Partial<typeof BackupService.config>): Promise<void> {
    try {
      // 設定のマージ
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // バックアップディレクトリの作成
      await this.ensureBackupDirectoryExists();

      // バックアップRPCの確認
      await this.ensureBackupFunctionsExist();

      // 自動バックアップの設定（必要に応じて）
      // this.setupAutoBackup();

      await LogService.info('system', 'バックアップサービスが初期化されました', { config: this.config });
    } catch (error) {
      await LogService.error('system', 'バックアップサービスの初期化中にエラーが発生しました', error);
    }
  },

  /**
   * 完全バックアップを作成
   * @param description バックアップの説明（オプション）
   * @returns バックアップファイルのパス
   */
  async createFullBackup(description?: string): Promise<string> {
    try {
      await LogService.info('database', '完全バックアップを開始します');
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const backupData: BackupData = {
        metadata: {
          timestamp,
          version: this.config.version,
          tables: BACKUP_TABLES,
          recordCount: {},
          checksums: {},
          description
        },
        data: {}
      };

      // 各テーブルのデータをエクスポート
      for (const table of BACKUP_TABLES) {
        await LogService.debug('database', `テーブル ${table} のバックアップを作成中`);
        
        const { data, error } = await supabase
          .from(table)
          .select('*');
          
        if (error) {
          await LogService.error('database', `テーブル ${table} のエクスポート中にエラーが発生`, error);
          continue;
        }
        
        // データの保存
        backupData.data[table] = data || [];
        
        // メタデータの更新
        backupData.metadata.recordCount[table] = (data || []).length;
        
        // チェックサムの計算
        const jsonData = JSON.stringify(data);
        const checksum = createHash('sha256').update(jsonData).digest('hex');
        backupData.metadata.checksums[table] = checksum;
        
        await LogService.debug('database', `テーブル ${table} をバックアップしました (${backupData.metadata.recordCount[table]} レコード)`);
      }

      // バックアップファイルの保存
      const fileName = `backup_${timestamp}.json`;
      const filePath = path.join(this.config.backupDirectory, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));
      
      // 古いバックアップを削除
      await this.cleanupOldBackups();
      
      await LogService.info('database', '完全バックアップが完了しました', {
        path: filePath,
        totalRecords: Object.values(backupData.metadata.recordCount).reduce((sum, count) => sum + count, 0)
      });
      
      return filePath;
    } catch (error) {
      await LogService.error('database', '完全バックアップの作成中にエラーが発生しました', error);
      throw error;
    }
  },

  /**
   * クリティカルデータのみのバックアップを作成
   * @param description バックアップの説明（オプション）
   * @returns バックアップファイルのパス
   */
  async createCriticalBackup(description?: string): Promise<string> {
    try {
      await LogService.info('database', 'クリティカルバックアップを開始します');
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const backupData: BackupData = {
        metadata: {
          timestamp,
          version: this.config.version,
          tables: CRITICAL_TABLES,
          recordCount: {},
          checksums: {},
          description: description || 'クリティカルテーブルのみのバックアップ'
        },
        data: {}
      };

      // 重要テーブルのみエクスポート
      for (const table of CRITICAL_TABLES) {
        await LogService.debug('database', `テーブル ${table} のバックアップを作成中`);
        
        const { data, error } = await supabase
          .from(table)
          .select('*');
          
        if (error) {
          await LogService.error('database', `テーブル ${table} のエクスポート中にエラーが発生`, error);
          continue;
        }
        
        // データの保存
        backupData.data[table] = data || [];
        
        // メタデータの更新
        backupData.metadata.recordCount[table] = (data || []).length;
        
        // チェックサムの計算
        const jsonData = JSON.stringify(data);
        const checksum = createHash('sha256').update(jsonData).digest('hex');
        backupData.metadata.checksums[table] = checksum;
        
        await LogService.debug('database', `テーブル ${table} をバックアップしました (${backupData.metadata.recordCount[table]} レコード)`);
      }

      // バックアップファイルの保存
      const fileName = `critical_backup_${timestamp}.json`;
      const filePath = path.join(this.config.backupDirectory, fileName);
      
      await fs.writeFile(filePath, JSON.stringify(backupData, null, 2));
      
      await LogService.info('database', 'クリティカルバックアップが完了しました', {
        path: filePath,
        totalRecords: Object.values(backupData.metadata.recordCount).reduce((sum, count) => sum + count, 0)
      });
      
      return filePath;
    } catch (error) {
      await LogService.error('database', 'クリティカルバックアップの作成中にエラーが発生しました', error);
      throw error;
    }
  },

  /**
   * バックアップからデータをリストア
   * @param backupPath バックアップファイルのパス
   * @param options リストアオプション
   * @returns リストア結果
   */
  async restoreFromBackup(
    backupPath: string, 
    options: { 
      clearBeforeRestore?: boolean; 
      onlyTables?: string[];
      skipTables?: string[];
    } = {}
  ): Promise<{ success: boolean; details: Record<string, any> }> {
    try {
      await LogService.info('database', 'バックアップからのリストアを開始します', { backupPath, options });
      
      // バックアップファイルの読み込み
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      const backupData: BackupData = JSON.parse(backupContent);
      
      // バージョンチェック
      if (backupData.metadata.version !== this.config.version) {
        await LogService.warn('database', 'バージョンの不一致があります', {
          backupVersion: backupData.metadata.version,
          currentVersion: this.config.version
        });
      }
      
      // リストア前のバックアップを作成（安全対策）
      const preRestoreBackupPath = await this.createFullBackup('リストア前の自動バックアップ');
      
      // リストア結果の詳細
      const restoreDetails: Record<string, any> = {
        timestamp: new Date().toISOString(),
        tablesRestored: 0,
        recordsRestored: 0,
        errors: {}
      };
      
      // 処理対象のテーブルを決定
      let tablesToRestore = backupData.metadata.tables;
      
      if (options.onlyTables && options.onlyTables.length > 0) {
        tablesToRestore = tablesToRestore.filter(table => options.onlyTables?.includes(table));
      }
      
      if (options.skipTables && options.skipTables.length > 0) {
        tablesToRestore = tablesToRestore.filter(table => !options.skipTables?.includes(table));
      }
      
      // 各テーブルのリストア
      for (const table of tablesToRestore) {
        try {
          await LogService.debug('database', `テーブル ${table} のリストアを開始します`);
          
          const tableData = backupData.data[table];
          
          if (!tableData || tableData.length === 0) {
            await LogService.warn('database', `テーブル ${table} にはデータがありません`);
            restoreDetails.errors[table] = 'データがありません';
            continue;
          }
          
          // テーブルのクリア（オプション）
          if (options.clearBeforeRestore) {
            const { error: clearError } = await supabase
              .from(table)
              .delete()
              .neq('id', 0); // すべての行を削除（条件は無視される）
              
            if (clearError) {
              await LogService.error('database', `テーブル ${table} のクリア中にエラーが発生`, clearError);
              restoreDetails.errors[table] = `クリアエラー: ${clearError.message}`;
              continue;
            }
          }
          
          // データの挿入
          const { error: insertError } = await supabase
            .from(table)
            .upsert(tableData, {
              onConflict: 'id' // idが存在する場合は更新
            });
            
          if (insertError) {
            await LogService.error('database', `テーブル ${table} のデータ挿入中にエラーが発生`, insertError);
            restoreDetails.errors[table] = `挿入エラー: ${insertError.message}`;
            continue;
          }
          
          // 成功記録
          restoreDetails.tablesRestored++;
          restoreDetails.recordsRestored += tableData.length;
          
          await LogService.info('database', `テーブル ${table} のリストアが完了しました (${tableData.length} レコード)`);
        } catch (tableError: any) {
          await LogService.error('database', `テーブル ${table} のリストア中にエラーが発生`, tableError);
          restoreDetails.errors[table] = `例外: ${tableError.message}`;
        }
      }
      
      // 全体の結果をログに記録
      const success = restoreDetails.tablesRestored > 0 && Object.keys(restoreDetails.errors).length === 0;
      
      if (success) {
        await LogService.info('database', 'バックアップからのリストアが完了しました', restoreDetails);
      } else {
        await LogService.warn('database', 'バックアップからのリストアが一部失敗しました', restoreDetails);
      }
      
      return {
        success,
        details: {
          ...restoreDetails,
          preRestoreBackupPath
        }
      };
    } catch (error: any) {
      await LogService.error('database', 'バックアップからのリストア中にエラーが発生しました', error);
      return {
        success: false,
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  },

  /**
   * 使用可能なバックアップの一覧を取得
   * @returns バックアップファイルのリスト
   */
  async listAvailableBackups(): Promise<{ path: string; metadata: BackupMetadata }[]> {
    try {
      await this.ensureBackupDirectoryExists();
      
      const files = await fs.readdir(this.config.backupDirectory);
      const backupFiles = files.filter(file => file.endsWith('.json'));
      const result = [];
      
      for (const file of backupFiles) {
        try {
          const filePath = path.join(this.config.backupDirectory, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const backupData = JSON.parse(content);
          
          result.push({
            path: filePath,
            metadata: backupData.metadata
          });
        } catch (fileError) {
          await LogService.warn('database', `バックアップファイル ${file} の読み込み中にエラーが発生`, fileError);
        }
      }
      
      // 新しい順にソート
      return result.sort((a, b) => {
        return new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime();
      });
    } catch (error) {
      await LogService.error('database', '使用可能なバックアップリストの取得中にエラーが発生しました', error);
      return [];
    }
  },

  /**
   * バックアップディレクトリの作成
   */
  async ensureBackupDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.config.backupDirectory);
    } catch (error) {
      // ディレクトリが存在しない場合は作成
      try {
        await fs.mkdir(this.config.backupDirectory, { recursive: true });
        await LogService.info('system', `バックアップディレクトリを作成しました: ${this.config.backupDirectory}`);
      } catch (mkdirError) {
        await LogService.error('system', 'バックアップディレクトリの作成中にエラーが発生しました', mkdirError);
        throw mkdirError;
      }
    }
  },

  /**
   * バックアップ関連のRPC関数が存在するか確認
   */
  async ensureBackupFunctionsExist(): Promise<void> {
    try {
      // バックアップ関数のチェック（必要に応じて作成）
      const { error: checkError } = await supabase.rpc('check_function_exists', { function_name: 'export_table_data' });
      
      if (checkError) {
        await LogService.info('database', 'バックアップ関数が存在しないため、作成します');
        
        // SQL関数の作成
        const createFunctionSQL = `
          CREATE OR REPLACE FUNCTION export_table_data(table_name TEXT)
          RETURNS JSONB
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
              result JSONB;
          BEGIN
              EXECUTE format('SELECT jsonb_agg(t) FROM %I t', table_name) INTO result;
              RETURN COALESCE(result, '[]'::jsonb);
          END;
          $$;
          
          -- テーブル存在確認関数
          CREATE OR REPLACE FUNCTION check_table_exists(table_name TEXT)
          RETURNS BOOLEAN
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
              table_exists BOOLEAN;
          BEGIN
              SELECT EXISTS (
                  SELECT FROM information_schema.tables 
                  WHERE table_schema = 'public'
                  AND table_name = check_table_exists.table_name
              ) INTO table_exists;
              
              RETURN table_exists;
          END;
          $$;
          
          -- 関数存在確認関数
          CREATE OR REPLACE FUNCTION check_function_exists(function_name TEXT)
          RETURNS BOOLEAN
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
              func_exists BOOLEAN;
          BEGIN
              SELECT EXISTS (
                  SELECT FROM pg_proc
                  JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
                  WHERE pg_proc.proname = check_function_exists.function_name
                  AND pg_namespace.nspname = 'public'
              ) INTO func_exists;
              
              RETURN func_exists;
          END;
          $$;
          
          -- SQL実行関数（注意: 危険な操作が可能なため、実運用では制限が必要）
          CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
          RETURNS VOID
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
              EXECUTE sql;
          END;
          $$;
        `;
        
        // SQLを実行
        const { error: createError } = await supabase.rpc('execute_sql', { sql: createFunctionSQL });
        
        if (createError) {
          await LogService.error('database', 'バックアップ関数の作成に失敗しました', createError);
          throw createError;
        }
        
        await LogService.info('database', 'バックアップ関数を作成しました');
      }
    } catch (error) {
      await LogService.error('database', 'バックアップ関数の確認・作成中にエラーが発生しました', error);
    }
  },

  /**
   * 古いバックアップファイルの削除
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listAvailableBackups();
      
      // バックアップ数が上限を超えている場合、古いものから削除
      if (backups.length > this.config.maxBackupCount) {
        // 削除対象（新しい順にソートされているので、後ろから削除）
        const backupsToDelete = backups.slice(this.config.maxBackupCount);
        
        for (const backup of backupsToDelete) {
          try {
            await fs.unlink(backup.path);
            await LogService.info('database', `古いバックアップを削除しました: ${backup.path}`);
          } catch (unlinkError) {
            await LogService.error('database', `バックアップファイルの削除中にエラーが発生: ${backup.path}`, unlinkError);
          }
        }
      }
    } catch (error) {
      await LogService.error('database', '古いバックアップのクリーンアップ中にエラーが発生しました', error);
    }
  },

  /**
   * バックアップファイルの検証
   * @param backupPath バックアップファイルのパス
   * @returns 検証結果
   */
  async validateBackup(backupPath: string): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const issues: string[] = [];
      
      // バックアップファイルの読み込み
      const content = await fs.readFile(backupPath, 'utf-8');
      let backupData: BackupData;
      
      try {
        backupData = JSON.parse(content);
      } catch (parseError) {
        return {
          valid: false,
          issues: ['バックアップファイルのJSON解析に失敗しました']
        };
      }
      
      // 基本構造のチェック
      if (!backupData.metadata) {
        issues.push('バックアップファイルにメタデータがありません');
      }
      
      if (!backupData.data) {
        issues.push('バックアップファイルにデータがありません');
      }
      
      // メタデータの妥当性チェック
      const metadata = backupData.metadata;
      
      if (!metadata.timestamp) {
        issues.push('タイムスタンプが見つかりません');
      }
      
      if (!metadata.version) {
        issues.push('バージョン情報が見つかりません');
      }
      
      if (!metadata.tables || !Array.isArray(metadata.tables) || metadata.tables.length === 0) {
        issues.push('テーブル情報が見つからないか無効です');
      }
      
      // 各テーブルのデータチェック
      if (metadata.tables && Array.isArray(metadata.tables)) {
        for (const table of metadata.tables) {
          const tableData = backupData.data[table];
          
          if (!tableData) {
            issues.push(`テーブル ${table} のデータがありません`);
            continue;
          }
          
          if (!Array.isArray(tableData)) {
            issues.push(`テーブル ${table} のデータが配列ではありません`);
            continue;
          }
          
          // レコード数の整合性チェック
          if (metadata.recordCount && metadata.recordCount[table] !== tableData.length) {
            issues.push(`テーブル ${table} のレコード数が一致しません（メタデータ: ${metadata.recordCount[table]}, 実際: ${tableData.length}）`);
          }
          
          // チェックサムの検証
          if (metadata.checksums && metadata.checksums[table]) {
            const currentChecksum = createHash('sha256').update(JSON.stringify(tableData)).digest('hex');
            
            if (currentChecksum !== metadata.checksums[table]) {
              issues.push(`テーブル ${table} のチェックサムが一致しません`);
            }
          }
        }
      }
      
      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error: any) {
      return {
        valid: false,
        issues: [`バックアップの検証中にエラーが発生しました: ${error.message}`]
      };
    }
  },

  /**
   * 定期バックアップのスケジューリング
   */
  setupAutoBackup(): void {
    const interval = this.config.autoBackupInterval;
    
    // 定期的なバックアップのスケジューリング
    setInterval(async () => {
      try {
        await LogService.info('system', '自動バックアップを開始します');
        const backupPath = await this.createFullBackup('自動バックアップ');
        await LogService.info('system', '自動バックアップが完了しました', { path: backupPath });
      } catch (error) {
        await LogService.error('system', '自動バックアップの実行中にエラーが発生しました', error);
      }
    }, interval);
    
    LogService.info('system', `自動バックアップをスケジュールしました（間隔: ${interval / (60 * 60 * 1000)} 時間）`);
  }
};

export default BackupService;
