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
    console.log('環境変数テーブルの初期化を実行中...');
    
    // テーブルが存在するか確認
    const { error: checkError } = await supabase.rpc('check_table_exists', { table_name: 'env_variables' });
    
    if (checkError) {
      console.log('テーブル存在確認に失敗しました、テーブルを作成します:', checkError.message);
      
      // テーブルを作成するSQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS env_variables (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // SQLを実行
      const { error: createError } = await supabase.rpc('execute_sql', { sql: createTableSQL });
      
      if (createError) {
        console.error('テーブル作成に失敗しました:', createError.message);
        return;
      }
      
      console.log('env_variablesテーブルを作成しました');
    }
    
    // 初期データの同期
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
 * 設定値を環境変数として追加/更新する
 * @param key キー
 * @param value 値
 * @param description 説明（オプション）
 * @returns 更新成功の可否
 */
export async function setEnvVariable(key: string, value: string, description?: string): Promise<boolean> {
  try {
    console.log(`環境変数を設定: ${key}`);
    
    // プロセス環境変数を更新
    process.env[key] = value;
    
    // データベースも更新
    const { error } = await supabase
      .from('env_variables')
      .upsert({
        key,
        value,
        description,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });
    
    if (error) {
      console.error(`環境変数 ${key} の設定中にエラーが発生:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`環境変数 ${key} の設定中に例外が発生:`, error);
    return false;
  }
}

/**
 * 環境変数を削除する
 * @param key 削除する環境変数のキー
 * @returns 削除成功の可否
 */
export async function deleteEnvVariable(key: string): Promise<boolean> {
  try {
    console.log(`環境変数を削除: ${key}`);
    
    // プロセス環境変数から削除
    delete process.env[key];
    
    // データベースからも削除
    const { error } = await supabase
      .from('env_variables')
      .delete()
      .eq('key', key);
    
    if (error) {
      console.error(`環境変数 ${key} の削除中にエラーが発生:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`環境変数 ${key} の削除中に例外が発生:`, error);
    return false;
  }
}

/**
 * すべての環境変数を取得する
 * @param includeSecrets 機密情報を含むかどうか
 * @returns 環境変数の配列
 */
export async function getAllEnvVariables(includeSecrets = false): Promise<any[]> {
  try {
    // データベースから全ての環境変数を取得
    const { data, error } = await supabase
      .from('env_variables')
      .select('key, value, description, updated_at');
    
    if (error) {
      console.error('環境変数の取得中にエラーが発生:', error);
      return [];
    }
    
    // 機密情報を除外するかどうか
    if (!includeSecrets) {
      const secretKeys = ['DISCORD_TOKEN', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'BRAVE_API_KEY', 'SUPABASE_ANON_KEY'];
      
      return data.map(env => {
        if (secretKeys.includes(env.key)) {
          return {
            ...env,
            value: '[HIDDEN]'
          };
        }
        return env;
      });
    }
    
    return data;
  } catch (error) {
    console.error('環境変数リストの取得中に例外が発生:', error);
    return [];
  }
}

/**
 * ボットステータスを更新
 */
async function updateBotStatus(): Promise<void> {
  try {
    // ボットステータステーブルが存在するか確認
    const { error: checkError } = await supabase.rpc('check_table_exists', { table_name: 'bot_status' });
    
    if (checkError) {
      console.log('bot_statusテーブルが存在しないため、作成します');
      
      // テーブルを作成するSQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS bot_status (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          message TEXT,
          last_restart TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // SQLを実行
      const { error: createError } = await supabase.rpc('execute_sql', { sql: createTableSQL });
      
      if (createError) {
        console.error('bot_statusテーブル作成に失敗しました:', createError.message);
        return;
      }
      
      console.log('bot_statusテーブルを作成しました');
    }
    
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
  syncEnvVariablesToDatabase,
  setEnvVariable,
  deleteEnvVariable,
  getAllEnvVariables
};
