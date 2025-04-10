/**
 * データベースバックアップスクリプト
 * 
 * 使用方法:
 * npm run backup [-- --critical --description="バックアップの説明"]
 * 
 * オプション:
 * --critical: クリティカルテーブルのみをバックアップ（デフォルトはすべてのテーブル）
 * --description="説明文": バックアップの説明を設定
 */

import path from 'path';
import dotenv from 'dotenv';
import LogService from '../services/log-service';
import BackupService from '../services/backup-service';
import { exit } from 'process';

// 環境変数の読み込み
dotenv.config();

// 引数の解析
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    critical: false,
    description: 'コマンドラインからの手動バックアップ'
  };
  
  for (const arg of args) {
    if (arg === '--critical') {
      options.critical = true;
    } else if (arg.startsWith('--description=')) {
      options.description = arg.slice('--description='.length);
    }
  }
  
  return options;
}

// メイン関数
async function main() {
  try {
    console.log('🔄 バックアップスクリプトを初期化中...');
    
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
    console.log('📋 バックアップオプション:', options);
    
    if (options.critical) {
      console.log('🔍 クリティカルテーブルのみのバックアップを開始します...');
      const backupPath = await BackupService.createCriticalBackup(options.description);
      console.log(`✅ クリティカルバックアップが完了しました: ${backupPath}`);
    } else {
      console.log('🔍 完全バックアップを開始します...');
      const backupPath = await BackupService.createFullBackup(options.description);
      console.log(`✅ 完全バックアップが完了しました: ${backupPath}`);
    }
    
    const backups = await BackupService.listAvailableBackups();
    console.log('\n📁 利用可能なバックアップ:');
    
    if (backups.length === 0) {
      console.log('  バックアップがありません');
    } else {
      backups.forEach((backup, index) => {
        const date = new Date(backup.metadata.timestamp).toLocaleString();
        const tables = backup.metadata.tables.length;
        const records = Object.values(backup.metadata.recordCount).reduce((sum, count) => sum + count, 0);
        
        console.log(`  ${index + 1}. ${path.basename(backup.path)} (${date})`);
        console.log(`     テーブル数: ${tables}, レコード数: ${records}`);
        console.log(`     説明: ${backup.metadata.description || 'なし'}`);
      });
    }
    
    console.log('\n🏁 バックアップスクリプトが正常に終了しました');
    exit(0);
  } catch (error) {
    console.error('❌ バックアップ中にエラーが発生しました:', error);
    exit(1);
  }
}

// スクリプトの実行
main();
