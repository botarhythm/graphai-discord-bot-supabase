/**
 * Supabase クライアント設定
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// Supabase URLとAnonキーの確認
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 必須環境変数の検証
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key must be provided in .env file');
  process.exit(1);
}

// Supabaseクライアントの作成
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔌 Supabase client initialized');

export default supabase;
