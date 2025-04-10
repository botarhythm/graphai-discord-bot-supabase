/**
 * APIサーバー
 * ヘルスチェックとBotステータスを提供
 */

import express from 'express';
import cors from 'cors';
import healthRouter from './health';
import LogService from '../services/log-service';

// Express アプリの作成
const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// リクエストロガー
app.use((req, res, next) => {
  const start = Date.now();
  
  // レスポンス送信後にログを記録
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    LogService[logLevel]('api', `${req.method} ${req.originalUrl}`, {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent') || 'unknown',
      ip: req.ip || 'unknown'
    });
  });
  
  next();
});

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    name: 'GraphAI Discord Bot API',
    version: '1.0.0',
    status: 'active',
    endpoints: ['/api/health']
  });
});

// ヘルスチェックルーターのマウント
app.use('/api/health', healthRouter);

// 404ハンドラー
app.use((req, res) => {
  LogService.warn('api', `404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: 'error',
    message: 'Not Found',
    path: req.originalUrl
  });
});

// エラーハンドラー
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  
  LogService.error('api', `Server Error: ${err.message}`, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });
  
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    path: req.originalUrl
  });
});

// サーバー起動関数
export const startServer = () => {
  return new Promise<void>((resolve, reject) => {
    try {
      const server = app.listen(PORT, () => {
        console.log(`🚀 API Server running on port ${PORT}`);
        LogService.info('api', `APIサーバーが起動しました`, { port: PORT });
        resolve();
      });
      
      // グレースフルシャットダウン
      process.on('SIGTERM', () => {
        LogService.info('api', 'SIGTERM received, shutting down API server');
        server.close(() => {
          LogService.info('api', 'API server closed');
        });
      });
      
      process.on('SIGINT', () => {
        LogService.info('api', 'SIGINT received, shutting down API server');
        server.close(() => {
          LogService.info('api', 'API server closed');
        });
      });
    } catch (error) {
      LogService.error('api', 'APIサーバーの起動に失敗しました', error);
      reject(error);
    }
  });
};

export default app;
