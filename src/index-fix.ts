/**
 * GraphAI × Discord マルチモーダルチャットボット「ボッチー」メインファイル（修正版）
 * Supabase版
 * 
 * - 動的インポートを静的インポートに変更
 * - エラーハンドリングを強化
 * - 接続ステータスをより詳細に表示
 */

// 基本インポート
import Blob from 'cross-blob';
import { Client, GatewayIntentBits, ChannelType, Partials } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Supabase連携
import supabase from './db/supabase';

// GraphAIエンジンを直接インポート（動的インポートからの変更）
import graphaiEngine from './graphai-engine';

// グローバルにBlobを設定
(globalThis as any).Blob = Blob;

// 環境変数の読み込み
dotenv.config();

// エラーロギング関数
function logAppError(context: string, error: unknown): void {
  const timestamp = new Date().toISOString();
  const errorLog = `\n===== ERROR LOG =====\nTimestamp: ${timestamp}\nContext: ${context}\nError: ${error instanceof Error ? error.message : String(error)}\nError Stack: ${error instanceof Error ? error.stack : 'N/A'}\n==================\n`;
  
  console.error(errorLog);
  
  fs.appendFile(path.join(process.cwd(), 'error.log'), errorLog)
    .catch(logErr => {
      console.error('Failed to write error log:', logErr);
    });
}

// 環境変数チェック
function checkEnvironmentVariables(): boolean {
  const requiredVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'GEMINI_API_KEY'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`⚠️ 必須環境変数が設定されていません: ${missingVars.join(', ')}`);
    return false;
  }
  
  return true;
}

// 必須環境変数のチェック
if (!checkEnvironmentVariables()) {
  console.error('⚠️ 必須環境変数が不足しているため、プログラムを終了します');
  process.exit(1);
}

// Discordクライアントの設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [
    Partials.Channel,     // DMチャンネルを部分的に取得するために必要
    Partials.Message,     // キャッシュないメッセージを処理するために必要
    Partials.User         // キャッシュないユーザーを処理するために必要
  ]
});

// デバッグイベントリスナー：すべてのイベントをログに記録
client.on('debug', (info) => {
  console.log(`[Discord Debug] ${info}`);
});

client.on('error', (error) => {
  logAppError('Discord Client Error', error);
});

// メッセージ受信イベント
client.on('messageCreate', async (message) => {
  // ボット自身のメッセージは無視
  if (message.author.bot) return;

  // 以下の条件以外は処理しない
  // 1. ボットがメンションされた場合
  // 2. DMの場合
  // 3. ボットが起点のスレッド内のメッセージ
  const botId = client.user?.id;
  const botMentionRegex = new RegExp(`<@!?${botId}>`, 'i');
  const isMentioned = botId && botMentionRegex.test(message.content);
  const isDM = !message.guild;
  
  // スレッド関連の確認（スレッドが存在し、親がボットか）
  let isThreadReply = false;
  if (message.channel.isThread && message.channel.isThread()) {
    try {
      const threadStarterMessage = await message.channel.fetchStarterMessage().catch(() => null);
      if (threadStarterMessage && threadStarterMessage.author.id === client.user?.id) {
        isThreadReply = true;
      }
    } catch (e) {
      console.error("Thread check error:", e);
    }
  }
  
  // 詳細なログ出力
  console.log(`Message received: "${message.content}" from ${message.author.tag} in ${message.guild ? message.guild.name : 'DM'}`);
  console.log(`Channel type: ${message.channel.type}`);
  console.log(`Check conditions: isMentioned=${isMentioned}, isDM=${isDM}, isThreadReply=${isThreadReply}`);

  // 条件チェック - どの条件も満たさない場合は処理しない
  if (!isMentioned && !isDM && !isThreadReply) {
    console.log("Message ignored: Does not meet bot interaction criteria");
    return;
  }

  console.log("Message will be processed: Meets bot interaction criteria");

  try {
    // メンションを取り除く処理
    let cleanContent = message.content;
    if (isMentioned && botId) {
      cleanContent = cleanContent.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    }

    console.log(`Processing content: "${cleanContent}"`);
    
    // GraphAIエンジンを使用（直接インポートに変更）
    try {
      // GraphAIエンジンによって処理される各種パラメータをセットアップ
      const response = await graphaiEngine.process('main', {
        discordInput: {
          content: cleanContent,
          authorId: message.author.id, 
          username: message.author.username,
          attachments: message.attachments.size > 0 ? 
            [...message.attachments.values()].map(attachment => attachment.url) : 
            []
        }
      });

      // 応答の送信
      if (response) {
        console.log(`Replying with: "${typeof response === 'string' ? 
          response.substring(0, 100) : 'Complex response'} ..."`);
          
        await message.reply(response.toString())
          .then(() => console.log('Reply sent successfully'))
          .catch(err => {
            console.error('Error replying to message:', err);
            // DMの場合は別のアプローチを試す
            if (!message.guild) {
              console.log('Trying alternative approach for DM');
              message.author.send(response.toString())
                .then(() => console.log('Direct message sent successfully'))
                .catch(dmErr => console.error('Failed to send direct message:', dmErr));
            }
          });
      }
    } catch (engErr) {
      logAppError('GraphAI Engine Error', engErr);
      message.reply('GraphAIエンジンでエラーが発生しました。管理者はログを確認してください。')
        .catch(err => console.error('Failed to send error message:', err));
    }
  } catch (error) {
    logAppError('Message Processing', error);
    message.reply('処理中に予期せぬエラーが発生しました。管理者はログを確認してください。')
      .catch(err => console.error('Failed to send error message:', err));
  }
});

// Discordボットのログイン完了
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
  console.log(`Bot is ready with intents: IntentsBitField { bitfield: ${client.options.intents.bitfield} }`);
  console.log(`Using Supabase URL: ${process.env.SUPABASE_URL?.slice(0, 20)}...`);

  // サーバー情報の表示
  console.log(`Connected to ${client.guilds.cache.size} server(s):`);
  client.guilds.cache.forEach(guild => {
    console.log(`- ${guild.name} (ID: ${guild.id})`);
  });
});

// ボットログイン
try {
  client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log("Bot login successful"))
    .catch(error => {
      logAppError('Login Failed', error);
      process.exit(1);
    });
} catch (error) {
  logAppError('Discord Login Error', error);
  process.exit(1);
}

// プロセス全体のエラーハンドリング
process.on('uncaughtException', (error) => {
  logAppError('Uncaught Exception', error);
  console.error('Critical error occurred, exiting...');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logAppError('Unhandled Rejection', reason);
  console.error('Unhandled promise rejection detected');
});
