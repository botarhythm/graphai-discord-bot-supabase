/**
 * 環境変数読み込みサービス
 * データベースに保存された環境変数もサポート
 */

import supabase from '../db/supabase';

/**
 * 環境変数を読み込む
 * プロセス環境変数 > データベース環境変数 の優先順位
 * @param key 環境変数キー
 * @param defaultValue デフォルト値（オプション）
 * @returns 環境変数の値
 */
export async function getEnvVariable(key: string, defaultValue?: string): Promise<string | undefined> {
  // プロセス環境変数を最優先
  if (process.env[key]) {
    return process.env[key];
  }
  
  try {
    // データベースから環境変数を取得
    const { data, error } = await supabase
      .from('env_variables')
      .select('value')
      .eq('key', key)
      .single();
      
    if (error) {
      console.warn(`環境変数 ${key} の取得中にエラー発生:`, error.message);
      return defaultValue;
    }
    
    return data?.value || defaultValue;
  } catch (error) {
    console.error(`環境変数 ${key} の取得中に例外発生:`, error);
    return defaultValue;
  }
}

/**
 * 環境変数のプリフェッチと設定
 * アプリケーション起動時に呼び出す
 */
export async function loadEnvironmentVariables(): Promise<void> {
  try {
    console.log('データベースから環境変数を読み込み中...');
    
    // よく使われる環境変数のリスト
    const commonEnvKeys = [
      'DISCORD_TOKEN',
      'DISCORD_CLIENT_ID',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'RECRAFT_API_KEY',
      'BRAVE_API_KEY',
      'PREFIX',
      'GUILD_ID',
      'ALLOW_ALL_SERVERS'
    ];
    
    // データベースにenv_variablesテーブルが存在するか確認
    const { error: tableError } = await supabase
      .from('env_variables')
      .select('key')
      .limit(1);
      
    if (tableError) {
      console.warn('env_variablesテーブルが存在しないか、アクセスできません:', tableError.message);
      console.log('env_variablesテーブルを作成します...');
      await initializeEnvVariablesTable();
    }
    
    // 一括でデータベースから取得
    const { data, error } = await supabase
      .from('env_variables')
      .select('key, value')
      .in('key', commonEnvKeys);
      
    if (error) {
      console.warn('環境変数の取得中にエラー発生:', error.message);
      return;
    }
    
    // 環境変数をプロセス環境変数にセット（もし未定義の場合）
    if (data && data.length > 0) {
      data.forEach((env) => {
        if (!process.env[env.key]) {
          process.env[env.key] = env.value;
          console.log(`環境変数設定: ${env.key}`);
        }
      });
      
      console.log(`${data.length}個の環境変数を設定しました`);
    } else {
      console.log('データベースから読み込める環境変数がありませんでした');
      // 初期環境変数をデータベースに保存
      await syncEnvVariablesToDatabase();
    }
    
    // ボットのステータスを更新
    await updateBotStatus();
    
  } catch (error) {
    console.error('環境変数のロード中にエラーが発生:', error);
  }
}

/**
 * 環境変数テーブルの初期化
 */
async function initializeEnvVariablesTable(): Promise<void> {
  try {
    // テーブルが存在しない場合の初期化処理
    // 注: テーブル作成はSupabaseコンソールで行うため、
    // ここでは初期データの同期のみを実行
    await syncEnvVariablesToDatabase();
  } catch (error) {
    console.error('環境変数テーブルの初期化中にエラーが発生:', error);
  }
}

/**
 * 環境変数をプロセスからデータベースに同期
 */
export async function syncEnvVariablesToDatabase(): Promise<void> {
  try {
    console.log('環境変数をデータベースに同期中...');
    
    // 重要な環境変数のリスト
    const importantEnvKeys = [
      'DISCORD_TOKEN',
      'DISCORD_CLIENT_ID', 
      'GEMINI_API_KEY',
      'BRAVE_API_KEY',
      'PREFIX',
      'GUILD_ID',
      'ALLOW_ALL_SERVERS',
      'OPENAI_API_KEY',
      'RECRAFT_API_KEY'
    ];
    
    // プロセス環境変数からデータ取得
    const envData = importantEnvKeys
      .filter(key => process.env[key])
      .map(key => ({
        key,
        value: process.env[key] || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
    
    if (envData.length === 0) {
      console.log('保存する環境変数が見つかりませんでした');
      return;
    }
    
    // 一括更新
    const { error } = await supabase
      .from('env_variables')
      .upsert(envData, {
        onConflict: 'key'
      });
    
    if (error) {
      console.error('環境変数の同期中にエラーが発生:', error);
    } else {
      console.log(`${envData.length}個の環境変数をデータベースに同期しました`);
    }
  } catch (error) {
    console.error('環境変数の同期中に例外が発生:', error);
  }
}

/**
 * ボットステータスを更新
 */
async function updateBotStatus(): Promise<void> {
  try {
    // ボットのステータスを更新
    const { error } = await supabase
      .from('bot_status')
      .upsert({
        id: await getStatusId(),
        status: 'running',
        message: 'ボットが正常に起動しました',
        last_restart: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (error) {
      console.warn('ボットステータスの更新中にエラーが発生:', error);
    }
  } catch (error) {
    console.error('ボットステータスの更新中に例外が発生:', error);
  }
}

/**
 * ステータスIDを取得（ない場合は作成）
 */
async function getStatusId(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('bot_status')
      .select('id')
      .limit(1)
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn('ボットステータスIDの取得中にエラーが発生:', error);
    }
    
    return data?.id || 'default-status';
  } catch (error) {
    console.error('ステータスID取得中に例外が発生:', error);
    return 'default-status';
  }
}

export default {
  getEnvVariable,
  loadEnvironmentVariables,
  syncEnvVariablesToDatabase
};
