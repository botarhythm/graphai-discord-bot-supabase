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
      'BRAVE_API_KEY',
      'PREFIX',
      'GUILD_ID',
      'ALLOW_ALL_SERVERS'
    ];
    
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
    }
    
    // ボットのステータスを更新
    await supabase
      .from('bot_status')
      .upsert({
        id: await getStatusId(),
        status: 'running',
        message: 'ボットが正常に起動しました',
        last_restart: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
  } catch (error) {
    console.error('環境変数のロード中にエラーが発生:', error);
  }
}

/**
 * ステータスIDを取得（ない場合は作成）
 */
async function getStatusId(): Promise<string> {
  const { data } = await supabase
    .from('bot_status')
    .select('id')
    .limit(1)
    .single();
    
  return data?.id || 'new-status';
}

export default {
  getEnvVariable,
  loadEnvironmentVariables
};
