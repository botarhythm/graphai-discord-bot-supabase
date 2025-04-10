/**
 * APIヘルスチェックエンドポイント
 * Railway向けに健康状態チェックを提供
 */

import express from 'express';
import supabase from '../db/supabase';

// ルーターの設定
const router = express.Router();

// ヘルスチェックカウンター
let healthCheckCounter = 0;

/**
 * 健康状態チェックハンドラー
 * /api/health エンドポイントにGETリクエストを処理
 */
router.get('/', async (req, res) => {
  try {
    healthCheckCounter++;
    
    // Supabaseの接続状態確認
    const { data, error } = await supabase
      .from('bot_status')
      .select('status, updated_at')
      .limit(1);
      
    // システム情報の取得
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      healthChecks: healthCheckCounter,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
    
    // Supabase接続が成功したかどうか
    if (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection failed',
        error: error.message,
        systemInfo
      });
    }
    
    // 正常レスポンス
    return res.status(200).json({
      status: 'ok',
      message: 'GraphAI Discord Bot is running',
      databaseStatus: 'connected',
      botStatus: data && data.length > 0 ? data[0].status : 'unknown',
      lastUpdate: data && data.length > 0 ? data[0].updated_at : null,
      systemInfo
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

export default router;
