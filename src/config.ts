/**
 * 設定ファイル
 */

import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

export default {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    prefix: process.env.PREFIX || '!',
    guildId: process.env.GUILD_ID,
    allowAllServers: process.env.ALLOW_ALL_SERVERS === 'true'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },
  recraft: {
    apiKey: process.env.RECRAFT_API_KEY,
  },
  brave: {
    apiKey: process.env.BRAVE_API_KEY,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  },
  graphai: {
    logLevel: 'info',
    enableMonitoring: true,
  }
};
