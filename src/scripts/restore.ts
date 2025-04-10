/**
 * データベース復元スクリプト
 * 
 * 使用方法:
 * npm run restore -- --file=バックアップファイル名 [--clear] [--tables=table1,table2,...]
 * 
 * オプション:
 * --file="backups/backup_2023-01-01.json": 復元するバックアップファイルのパス（必須）
 * --clear: 復元前にテーブルをクリアする（デフォルトはfalse）
 * --tables="conversation_histories,bot_settings": 復元するテーブルを指定（カンマ区切り、デフォルトはすべて）
 * --skip="system_logs,api_logs": スキップするテーブルを指定（カンマ区切り）
 */

import path from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import LogService from '../services/log-service';
import BackupService from '../services/backup-service';
import { exit } from 'process';
import readline from 'readline';

// 環境変数の読み込み
dotenv.config();

// 対話式の確認
function askForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${question} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// 引数の解析
function parseArguments() {
  const args = process.argv.slice(2);
  const options: {
    file?: string;
    clear: boolean;
    tables?: string[];
    skipTables?: string[];
  } = {
    clear: false
  };
  
  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length);
    } else if (arg === '--clear') {
      options.clear = true;
    } else if (arg.startsWith('--tables=')) {
      const tablesStr = arg.slice('--tables='.length);
      options.tables = tablesStr.split(',').map(t => t.trim());
    } else if (arg.startsWith('--skip=')) {
      const skipStr = arg.slice('--skip='.length);
      options.skipTables = skipStr.split(',').map(t => t.trim());
    }
  }
  
  return options;
}

// メイン関数
async function main() {
  try {
    console.log('🔄 リストアスクリプトを初期化中...');
    
    // ログサービスの初期化
    await LogService.initialize({
      enableConsole: true,
      enableDatabase: false,
      enableFile: true,
      logLevel: 'info'
    });
    
    // バックアップサービスの初期化
    await BackupService.initialize();
    
    const options = parseArguments();
    console.log('📋 リストアオプション:', options);
    
    // バックアップファイルのチェック
    if (!options.file) {
      console.log('❌ エラー: バックアップファイルが指定されていません');
      console.log('使用例: npm run restore -- --file=バックアップファイルパス');
      
      // 利用可能なバックアップを表示
      const backups = await BackupService.listAvailableBackups();
      
      if (backups.length > 0) {
        console.log('\n📁 利用可能なバックアップ:');
        backups.forEach((backup, index) => {
          const date = new Date(backup.metadata.timestamp).toLocaleString();
          console.log(`  ${index + 1}. ${path.basename(backup.path)} (${date})`);
        });
      }
      
      exit(1);
    }
    
    // ファイルパスの調整
    let filePath = options.file;
    if (!path.isAbsolute(filePath)) {
      // 相対パスの場合、backupsディレクトリからの相対パスと仮定
      const backupsDir = path.join(process.cwd(), 'backups');
      filePath = path.join(backupsDir, filePath);
      
      // backups/を含まない場合、追加
      if (!options.file.includes('backups/') && !options.file.includes('backups\\')) {
        filePath = path.join(backupsDir, options.file);
      }
    }
    
    // ファイルの存在チェック
    if (!existsSync(filePath)) {
      console.log(`❌ エラー: バックアップファイル ${filePath} が見つかりません`);
      exit(1);
    }
    
    // バックアップの検証
    console.log('🔍 バックアップファイルを検証中...');
    const validation = await BackupService.validateBackup(filePath);
    
    if (!validation.valid) {
      console.log('⚠️ 警告: バックアップファイルの検証で問題が見つかりました');
      console.log('問題点:');
      validation.issues.forEach(issue => console.log(`  - ${issue}`));
      
      const proceed = await askForConfirmation('問題があるバックアップを使用して復元を続行しますか？');
      if (!proceed) {
        console.log('❌ 復元を中止しました');
        exit(1);
      }
    } else {
      console.log('✅ バックアップファイルの検証に成功しました');
    }
    
    // 警告とユーザー確認
    if (options.clear) {
      const confirmClear = await askForConfirmation(
        '⚠️ WARNING: このオペレーションは指定されたテーブルの既存データをすべて削除します。続行しますか？'
      );
      
      if (!confirmClear) {
        console.log('❌ 復元を中止しました');
        exit(1);
      }
    } else {
      const confirmRestore = await askForConfirmation(
        '既存のデータを保持したまま復元を行います。この操作は一部データの重複を引き起こす可能性があります。続行しますか？'
      );
      
      if (!confirmRestore) {
        console.log('❌ 復元を中止しました');
        exit(1);
      }
    }
    
    // バックアップの復元実行
    console.log('📤 データベースの復元を開始します...');
    const result = await BackupService.restoreFromBackup(filePath, {
      clearBeforeRestore: options.clear,
      onlyTables: options.tables,
      skipTables: options.skipTables
    });
    
    // 結果の表示
    if (result.success) {
      console.log('✅ データベースの復元が完了しました');
      console.log(`  - 復元されたテーブル数: ${result.details.tablesRestored}`);
      console.log(`  - 復元されたレコード数: ${result.details.recordsRestored}`);
    } else {
      console.log('⚠️ データベースの復元が部分的に失敗しました');
      
      if (result.details.errors) {
        console.log('エラーが発生したテーブル:');
        Object.entries(result.details.errors).forEach(([table, error]) => {
          console.log(`  - ${table}: ${error}`);
        });
      }
      
      if (result.details.tablesRestored > 0) {
        console.log(`一部のテーブル (${result.details.tablesRestored}) は正常に復元されました`);
      }
    }
    
    // 自動バックアップ情報の表示
    if (result.details.preRestoreBackupPath) {
      console.log(`ℹ️ リストア前の状態は自動的にバックアップされました: ${result.details.preRestoreBackupPath}`);
    }
    
    console.log('\n🏁 リストアスクリプトが終了しました');
    exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ データベースリストア中にエラーが発生しました:', error);
    exit(1);
  }
}

// スクリプトの実行
main();
