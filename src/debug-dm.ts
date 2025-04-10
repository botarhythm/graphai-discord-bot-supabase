/**
 * DMとメンション応答のデバッグスクリプト
 * 
 * このスクリプトは、ボットがDMとメンションに応答しない問題を診断するためのものです。
 * デプロイ後に自動的に実行され、詳細なログを出力します。
 */

import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';

// 環境変数の読み込み
dotenv.config();

// ログ出力先の設定
const LOG_FILE = path.join(process.cwd(), 'dm-debug.log');

// ログ出力関数
async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(logMessage);
  
  try {
    await fs.appendFile(LOG_FILE, logMessage);
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

// メイン診断関数
async function debugDmAndMentions(): Promise<void> {
  await log('=== DMとメンション応答デバッグ開始 ===');
  
  // 環境変数の確認
  await log('環境変数の確認...');
  if (!process.env.DISCORD_TOKEN) {
    await log('❌ DISCORD_TOKENが設定されていません');
    return;
  }
  
  try {
    // Discordクライアントの初期化 - すべての可能なインテントを含める
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction
      ]
    });

    // すべてのイベントをログに記録
    client.on('debug', async (info) => {
      await log(`[Debug] ${info}`);
    });

    client.on('error', async (error) => {
      await log(`[Error] ${error.message}`);
    });

    // レディイベント
    client.once(Events.ClientReady, async () => {
      await log(`✅ ボットが起動しました: ${client.user?.tag}`);
      await log(`ボットID: ${client.user?.id}`);
      await log(`サーバー数: ${client.guilds.cache.size}`);
      
      // インテント状態の確認
      const intents = client.options.intents;
      await log(`設定されているインテント: ${intents}`);
      
      // DMパーミッションの確認
      await log(`DMパーミッション: ${client.application?.botPublic ? '有効' : '不明'}`);
      
      // サーバー一覧
      await log('参加しているサーバー:');
      client.guilds.cache.forEach(guild => {
        log(`- ${guild.name} (ID: ${guild.id}, メンバー数: ${guild.memberCount})`);
      });
      
      // 自分自身にDMを送信する実験
      try {
        const owner = await client.application?.fetch();
        if (owner?.owner) {
          const ownerUser = await client.users.fetch(owner.owner.id);
          await log(`オーナー: ${ownerUser.tag} (ID: ${ownerUser.id})`);
          await ownerUser.send('DMテスト: このメッセージが表示されていればDMの送信は正常です。');
          await log('✅ オーナーへのDMを送信しました');
        } else {
          await log('⚠️ アプリケーションオーナーが取得できませんでした');
        }
      } catch (dmErr) {
        await log(`❌ DM送信中にエラーが発生: ${dmErr instanceof Error ? dmErr.message : String(dmErr)}`);
      }
      
      // 5分後に終了
      setTimeout(() => {
        log('デバッグ完了、終了します...');
        client.destroy();
        process.exit(0);
      }, 5 * 60 * 1000);
    });

    // メッセージイベント
    client.on(Events.MessageCreate, async (message) => {
      // ボット自身のメッセージは無視
      if (message.author.bot) return;
      
      // メッセージの詳細情報をログに記録
      await log(`メッセージを受信: "${message.content}" from ${message.author.tag}`);
      await log(`チャンネルタイプ: ${message.channel.type}`);
      await log(`サーバー: ${message.guild?.name || 'DM'}`);
      await log(`チャンネル: ${message.channel.id}`);
      
      // DMかどうかを確認
      const isDM = !message.guild;
      await log(`isDM: ${isDM}`);
      
      // メンションかどうかを確認
      const botId = client.user?.id;
      const isMentioned = botId && message.mentions.users.has(botId);
      await log(`isMentioned: ${isMentioned}`);
      
      // メッセージに応答
      try {
        if (isDM) {
          await message.reply('DMを受信しました！このメッセージが表示されていればDM応答は正常です。');
          await log('✅ DMに応答しました');
        } else if (isMentioned) {
          await message.reply('メンションを受信しました！このメッセージが表示されていればメンション応答は正常です。');
          await log('✅ メンションに応答しました');
        }
      } catch (replyErr) {
        await log(`❌ 応答中にエラーが発生: ${replyErr instanceof Error ? replyErr.message : String(replyErr)}`);
      }
    });

    // ログイン
    await client.login(process.env.DISCORD_TOKEN);
    await log('Discord接続中...');
  } catch (error) {
    await log(`❌ 致命的なエラーが発生: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      await log(`スタックトレース: ${error.stack}`);
    }
  }
}

// 実行
debugDmAndMentions().catch(err => {
  console.error('デバッグスクリプトエラー:', err);
});
