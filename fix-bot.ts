/**
 * ボット修正スクリプト
 * 
 * このスクリプトは、Discord Botの応答性に関する問題を診断し修正します。
 * 実行すると以下のチェックと修正を行います：
 * 1. 環境変数の確認
 * 2. Supabase接続のテスト
 * 3. Discordボットの設定確認
 * 4. エラーログの出力
 */

import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// 環境変数の読み込み
dotenv.config();

// ログ出力関数
async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage);
  
  try {
    await fs.appendFile(path.join(process.cwd(), 'bot-fix.log'), logMessage);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

// メイン診断関数
async function diagnoseAndFix(): Promise<void> {
  await log('=== ボット診断開始 ===');
  
  // 1. 環境変数のチェック
  await log('環境変数のチェック...');
  const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'GEMINI_API_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    await log(`⚠️ 以下の環境変数が設定されていません: ${missingVars.join(', ')}`);
  } else {
    await log('✅ すべての必須環境変数が設定されています');
  }
  
  // トークンの先頭部分を表示（セキュリティのため全体は表示しない）
  if (process.env.DISCORD_TOKEN) {
    const tokenPrefix = process.env.DISCORD_TOKEN.substring(0, 10) + '...';
    await log(`Discord Token: ${tokenPrefix}`);
  }
  
  // 2. Supabase接続テスト
  await log('Supabaseとの接続テスト...');
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Supabase URL or Anon Key is missing');
    }
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // シンプルなクエリを実行してみる
    const { data, error } = await supabase
      .from('bot_settings')
      .select('key, value')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    await log(`✅ Supabase接続成功! データ取得: ${JSON.stringify(data)}`);
  } catch (error) {
    await log(`❌ Supabase接続エラー: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // 3. Discordボットのテスト
  await log('Discordボットの接続テスト...');
  try {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('Discord Token is missing');
    }
    
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User
      ]
    });
    
    // エラーハンドリング
    client.on('error', (error) => {
      log(`Discord Client Error: ${error.message}`);
    });
    
    // 一度接続して切断するだけのテスト
    client.once('ready', async () => {
      await log(`✅ Discord接続成功! 接続クライアント: ${client.user?.tag}`);
      
      // テストメッセージを送信
      try {
        // ここではGUILDIDがある場合のみテストメッセージを送信
        if (process.env.GUILD_ID) {
          const guild = await client.guilds.fetch(process.env.GUILD_ID);
          const channels = await guild.channels.fetch();
          
          // 最初のテキストチャンネルを探す
          const textChannel = channels.find(channel => 
            channel?.type === 0 || channel?.type === 5
          );
          
          if (textChannel && textChannel.isTextBased()) {
            await textChannel.send('ボット診断テスト: このメッセージが見えれば、ボットは正常に動作しています。');
            await log('✅ テストメッセージ送信成功!');
          } else {
            await log('⚠️ テストメッセージを送信するテキストチャンネルが見つかりませんでした');
          }
        } else {
          await log('⚠️ GUILD_IDが設定されていないため、テストメッセージは送信しません');
        }
      } catch (msgErr) {
        await log(`❌ テストメッセージ送信エラー: ${msgErr instanceof Error ? msgErr.message : String(msgErr)}`);
      }
      
      // テスト終了後に切断
      client.destroy();
      await log('Discord接続テスト完了、切断しました');
    });
    
    // テスト用にログイン
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    await log(`❌ Discordボット接続エラー: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // 4. ファイルシステムの確認
  await log('ファイルシステムの確認...');
  try {
    // error.logが存在するか確認
    const errorLogPath = path.join(process.cwd(), 'error.log');
    try {
      const errorLogStat = await fs.stat(errorLogPath);
      if (errorLogStat.isFile()) {
        // 最新のエラーログを読み取り
        const errorLog = await fs.readFile(errorLogPath, 'utf8');
        const lastErrors = errorLog.split('===== ERROR LOG =====').pop();
        await log(`最新のエラーログ: ${lastErrors?.substring(0, 500)}${lastErrors && lastErrors.length > 500 ? '...(省略)' : ''}`);
      }
    } catch (statErr) {
      await log('エラーログファイルが見つかりません');
    }
    
    // データディレクトリが存在するか確認
    const dataDir = path.join(process.cwd(), 'data');
    try {
      const dataDirStat = await fs.stat(dataDir);
      if (dataDirStat.isDirectory()) {
        await log('データディレクトリが存在します');
      }
    } catch (dirErr) {
      await log('データディレクトリが見つかりません、作成します...');
      try {
        await fs.mkdir(dataDir, { recursive: true });
        await log('データディレクトリを作成しました');
      } catch (mkdirErr) {
        await log(`データディレクトリの作成に失敗しました: ${mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr)}`);
      }
    }
  } catch (fsErr) {
    await log(`❌ ファイルシステム確認エラー: ${fsErr instanceof Error ? fsErr.message : String(fsErr)}`);
  }
  
  await log('=== ボット診断完了 ===');
}

// メイン実行
diagnoseAndFix().catch(err => {
  console.error('診断スクリプトエラー:', err);
});
