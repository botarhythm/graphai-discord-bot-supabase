/**
 * GraphAI × Discord マルチモーダルチャットボット「ボッチー」メインファイル
 * Supabase版
 */

// Blobのインポート
import Blob from 'cross-blob';
import { Client, GatewayIntentBits, ChannelType, Partials, ActivityType } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Supabase連携
import supabase from './db/supabase';
import envLoader from './services/env-loader';
import LogService from './services/log-service';
import BackupService from './services/backup-service';

// グローバルにBlobを設定
(globalThis as any).Blob = Blob;

// 環境変数の読み込み（.envファイルとデータベース）
dotenv.config();

// アプリケーションバージョン
const APP_VERSION = '1.0.0';

// メイン関数
async function main() {
  try {
    console.log(`
    ██████   ██████  ████████  ██████ ██   ██ ██    ██ 
    ██   ██ ██    ██    ██    ██      ██   ██  ██  ██  
    ██████  ██    ██    ██    ██      ███████   ████   
    ██   ██ ██    ██    ██    ██      ██   ██    ██    
    ██████   ██████     ██     ██████ ██   ██    ██    
    `);
    console.log(`ボッチー - GraphAI × Discord Bot (v${APP_VERSION})`);
    console.log('Supabase版 - 起動中...\n');
    
    // サービスの初期化
    console.log('🔄 サービスを初期化中...');
    
    // ログサービスの初期化
    await LogService.initialize({
      enableConsole: true,
      enableDatabase: true,
      enableFile: true,
      logLevel: 'info'
    });
    
    // データベースから環境変数を読み込む
    await envLoader.loadEnvironmentVariables();
    
    // バックアップサービスの初期化
    await BackupService.initialize();
    
    // 起動ログを記録
    await LogService.info('system', 'アプリケーションが起動しました', {
      version: APP_VERSION,
      nodeVersion: process.version,
      platform: process.platform
    });
    
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

    // エラーロギング関数
    async function logAppError(context: string, error: unknown): Promise<void> {
      const timestamp = new Date().toISOString();
      const errorLog = `\n===== ERROR LOG =====\nTimestamp: ${timestamp}\nContext: ${context}\nError: ${error instanceof Error ? error.message : String(error)}\nError Stack: ${error instanceof Error ? error.stack : 'N/A'}\n==================\n`;
      
      console.error(errorLog);
      
      // エラーをログサービスに記録
      await LogService.error('system', `エラーが発生しました: ${context}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'N/A'
      });
      
      // エラーログファイルに追記
      try {
        await fs.appendFile(path.join(process.cwd(), 'error.log'), errorLog);
      } catch (logErr) {
        console.error('Failed to write error log:', logErr);
      }
    }

    // デバッグイベントリスナー：すべてのイベントをログに記録
    client.on('debug', async (info) => {
      if (process.env.DEBUG_MODE === 'true') {
        console.log(`[Discord Debug] ${info}`);
        await LogService.debug('discord', info);
      }
    });

    client.on('error', async (error) => {
      await logAppError('Discord Client Error', error);
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
          await LogService.error('discord', "スレッドチェック中にエラーが発生", e);
        }
      }
      
      // 詳細なログ出力（デバッグモード時のみ）
      if (process.env.DEBUG_MODE === 'true') {
        console.log(`Message received: "${message.content}" from ${message.author.tag} in ${message.guild ? message.guild.name : 'DM'}`);
        console.log(`Channel type: ${message.channel.type}`);
        console.log(`Check conditions: isMentioned=${isMentioned}, isDM=${isDM}, isThreadReply=${isThreadReply}`);
      }

      // 条件チェック - どの条件も満たさない場合は処理しない
      if (!isMentioned && !isDM && !isThreadReply) {
        if (process.env.DEBUG_MODE === 'true') {
          console.log("Message ignored: Does not meet bot interaction criteria");
        }
        return;
      }

      // メッセージの処理をログに記録
      await LogService.info('user', 'メッセージを受信しました', {
        userId: message.author.id,
        username: message.author.username,
        channelType: message.channel.type,
        guildName: message.guild?.name || 'DM',
        contentLength: message.content.length,
        hasAttachments: message.attachments.size > 0
      });

      try {
        // メンションを取り除く処理
        let cleanContent = message.content;
        if (isMentioned && botId) {
          cleanContent = cleanContent.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
        }

        if (process.env.DEBUG_MODE === 'true') {
          console.log(`Processing content: "${cleanContent}"`);
        }
        
        // ステータス更新
        client.user?.setPresence({
          status: 'online',
          activities: [{
            name: '考え中...',
            type: ActivityType.Playing
          }]
        });
        
        // GraphAIエンジンをインポート
        import('./graphai-engine').then(async (module) => {
          const graphaiEngine = module.default;
          
          // 処理開始時間を記録
          const startTime = Date.now();
          
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

          // 処理時間を計算
          const processingTime = Date.now() - startTime;
          
          // 応答処理をログに記録
          await LogService.info('ai', 'AI処理が完了しました', {
            userId: message.author.id,
            processingTimeMs: processingTime,
            responseLength: typeof response === 'string' ? response.length : 'complex response'
          });
          
          // ステータスを戻す
          client.user?.setPresence({
            status: 'online',
            activities: [{
              name: 'チャット待機中',
              type: ActivityType.Listening
            }]
          });

          // 応答の送信
          if (response) {
            if (process.env.DEBUG_MODE === 'true') {
              console.log(`Replying with: "${typeof response === 'string' ? 
                response.substring(0, 100) : 'Complex response'} ..."`);
            }
              
            await message.reply(response.toString())
              .then(() => LogService.debug('discord', '返信を送信しました'))
              .catch(async (err) => {
                await LogService.error('discord', 'メッセージ返信中にエラーが発生', err);
                // DMの場合は別のアプローチを試す
                if (!message.guild) {
                  await LogService.debug('discord', 'DMへの代替送信を試みます');
                  message.author.send(response.toString())
                    .then(() => LogService.debug('discord', 'DMを送信しました'))
                    .catch(dmErr => LogService.error('discord', 'DM送信中にエラーが発生', dmErr));
                }
              });
          }
        }).catch(async (error) => {
          await logAppError('GraphAI Engine Import', error);
          await message.reply('GraphAIエンジンの読み込み中にエラーが発生しました。管理者はログを確認してください。')
            .catch(err => LogService.error('discord', '代替エラーメッセージ送信中にエラーが発生', err));
        });
      } catch (error) {
        await logAppError('Message Processing', error);
        await message.reply('処理中に予期せぬエラーが発生しました。管理者はログを確認してください。')
          .catch(err => LogService.error('discord', 'エラーメッセージ送信中にエラーが発生', err));
      }
    });

    // 定期的なシステムチェック（1時間ごと）
    const hourlyCheck = async () => {
      try {
        await LogService.info('system', '定期システムチェックを実行中...');
        
        // システムステータスの確認
        const uptimeHours = process.uptime() / 3600;
        await LogService.info('system', 'システムステータス', {
          uptime: uptimeHours.toFixed(2) + '時間',
          memoryUsage: process.memoryUsage(),
          clientStatus: client.isReady() ? 'ready' : 'not ready'
        });
        
        // 日次バックアップの作成（3時〜4時の間の場合）
        const currentHour = new Date().getHours();
        if (currentHour >= 3 && currentHour < 4) {
          await LogService.info('system', '日次バックアップを開始します');
          const backupPath = await BackupService.createFullBackup('日次自動バックアップ');
          await LogService.info('system', '日次バックアップが完了しました', { path: backupPath });
        }
        
        // 古いログのクリーンアップ
        await LogService.cleanupDatabaseLogs();
      } catch (error) {
        await LogService.error('system', '定期システムチェック中にエラーが発生', error);
      }
      
      // 次の時間に再度実行
      setTimeout(hourlyCheck, 60 * 60 * 1000);
    };

    // Discordボットのログイン完了
    client.once('ready', async () => {
      console.log(`\n🤖 ログイン成功: ${client.user?.tag}`);
      await LogService.info('discord', 'Discordへの接続が完了しました', {
        username: client.user?.tag,
        id: client.user?.id,
        guilds: client.guilds.cache.size
      });
      
      // ステータスを設定
      client.user?.setPresence({
        status: 'online',
        activities: [{
          name: 'チャット待機中',
          type: ActivityType.Listening
        }]
      });
      
      // 各種情報を表示
      console.log(`ㅤサーバー数: ${client.guilds.cache.size}`);
      console.log(`ㅤBot User ID: ${client.user?.id}`);
      console.log(`ㅤSupabase URL: ${process.env.SUPABASE_URL?.slice(0, 20)}...`);
      console.log(`ㅤNode.js: ${process.version}`);
      console.log(`ㅤDiscord.js: v14\n`);
      
      // ボット状態の更新
      await supabase
        .from('bot_status')
        .upsert({
          id: '1', // ダミーIDを使用
          status: 'online',
          message: `ボットがオンラインになりました (${new Date().toLocaleString('ja-JP')})`,
          last_restart: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .then(() => console.log('🟢 ボットステータスを更新: オンライン'))
        .catch(err => LogService.error('database', 'ボットステータス更新中にエラーが発生', err));
      
      // 起動完了ログ
      await LogService.info('system', 'ボットが正常に起動しました', {
        version: APP_VERSION,
        guilds: client.guilds.cache.size,
        users: client.users.cache.size
      });
      
      // 初回のシステムチェックを開始
      hourlyCheck();
    });

    // ボットログイン
    try {
      await client.login(process.env.DISCORD_TOKEN);
      console.log("🔑 ログイン中...");
    } catch (error) {
      await logAppError('Login Failed', error);
      process.exit(1);
    }
  } catch (error) {
    console.error('致命的な初期化エラー:', error);
    process.exit(1);
  }
}

// プロセス全体のエラーハンドリング
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await LogService.fatal('system', '未捕捉の例外が発生しました', {
    error: error.message,
    stack: error.stack
  });
  
  // クリティカルデータのバックアップを試行
  try {
    console.log('クリティカルデータのバックアップを試行中...');
    await BackupService.createCriticalBackup('クラッシュ前の緊急バックアップ');
  } catch (backupError) {
    console.error('緊急バックアップに失敗:', backupError);
  }
  
  console.error('システムを終了します...');
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled Rejection:', reason);
  await LogService.error('system', '未処理のプロミス拒否が発生しました', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : 'スタックトレースなし'
  });
});

// アプリケーションの起動
main().catch(async (err) => {
  console.error('アプリケーション起動中の致命的エラー:', err);
  
  // LogServiceが初期化されているかどうかを確認
  if (typeof LogService.fatal === 'function') {
    await LogService.fatal('system', 'アプリケーション起動中の致命的エラー', err);
  }
  
  process.exit(1);
});
