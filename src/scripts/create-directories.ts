/**
 * 必要なディレクトリ構造を作成するユーティリティスクリプト
 * 初期セットアップ時に実行
 */

import fs from 'fs/promises';
import path from 'path';

// 作成するディレクトリ
const directories = [
  'backups',      // バックアップファイル
  'logs',         // ログファイル
  'data',         // その他のデータファイル
  'data/cache',   // キャッシュデータ
  'data/temp'     // 一時ファイル
];

// メイン関数
async function createDirectories() {
  console.log('必要なディレクトリを作成中...');
  
  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir);
    
    try {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`✅ ディレクトリを作成しました: ${dir}`);
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        console.log(`ℹ️ ディレクトリは既に存在します: ${dir}`);
      } else {
        console.error(`❌ ディレクトリの作成に失敗しました: ${dir}`, error);
      }
    }
  }
  
  // .gitkeepファイルを作成
  for (const dir of directories) {
    const gitkeepPath = path.join(process.cwd(), dir, '.gitkeep');
    
    try {
      await fs.writeFile(gitkeepPath, '# This file ensures the directory is included in git\n');
      console.log(`✅ .gitkeepファイルを作成しました: ${dir}/.gitkeep`);
    } catch (error) {
      console.error(`❌ .gitkeepファイルの作成に失敗しました: ${dir}/.gitkeep`, error);
    }
  }
  
  console.log('✅ すべてのディレクトリが作成されました');
}

// スクリプトの実行
createDirectories().catch(error => {
  console.error('ディレクトリ作成中にエラーが発生しました:', error);
  process.exit(1);
});
