# GraphAI × Discord マルチモーダルチャットボット（Supabase版）

## プロジェクト概要

GraphAI技術を活用した、高度なマルチモーダル対応 Discordボット「ボッチー」のプロジェクトリポジトリです。
Supabaseを使用してデータを管理し、永続性と拡張性を実現しています。

## 主要機能

- Web検索（Brave Search API連携）
- マルチモーダル対話
- GraphAIによる柔軟なワークフロー管理
- Supabaseによるデータ永続化
- 会話履歴のデータベース保存
- API使用量のトラッキング

## 技術スタック

- Node.js v20+
- TypeScript
- Discord.js v14
- GraphAI
- Brave Search API
- Supabase (PostgreSQL)

## セットアップ手順

1. リポジトリをクローン
```bash
git clone https://github.com/botarhythm/graphai-discord-bot-supabase.git
cd graphai-discord-bot-supabase
```

2. 依存関係をインストール
```bash
npm install
```

3. 環境変数を設定
`.env`ファイルを作成し、以下の情報を追加：
```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
GEMINI_API_KEY=your_gemini_api_key
BRAVE_API_KEY=your_brave_search_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Supabaseプロジェクトの設定
- Supabaseプロジェクトを作成
- 必要なテーブルとスキーマを作成（プロジェクトディレクトリ内の`migrations`フォルダを参照）

5. ビルドと起動
```bash
npm run build
npm start
```

## 開発モード

```bash
npm run dev
```

## Supabaseデータベースモデル

このボットは以下のテーブルを使用します：

- `conversation_histories` - ユーザーごとの会話履歴
- `api_usage` - API使用量のトラッキング
- `bot_settings` - ボットの設定情報

## ライセンス

[ライセンス情報を追加]

## コントリビューション

[コントリビューションガイドラインを追加]
