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
- バックアップ/リストア機能
- Railwayに最適化されたデプロイ設定
- ヘルスチェックとモニタリング機能

## 技術スタック

- Node.js v20+
- TypeScript
- Discord.js v14
- GraphAI
- Brave Search API
- Supabase (PostgreSQL)
- Express (APIサーバー)
- Railway (ホスティング)

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
- Supabaseプロジェクトを設定 (ID: qqlexzgdlszybmzpgeps)
- 初回実行時、必要なテーブルが自動的に作成されます

5. ビルドと起動
```bash
npm run build
npm start
```

## 開発モード

```bash
npm run dev
```

## コマンド一覧

- `npm start` - アプリケーションを起動
- `npm run build` - TypeScriptコードをビルド
- `npm run dev` - 開発モードで実行（ホットリロード）
- `npm run backup` - データベースのバックアップを作成
- `npm run restore` - バックアップからデータを復元
- `npm run setup-dirs` - 必要なディレクトリ構造を作成
- `npm run diagnose` - 問題診断ツールを実行

## バックアップと復元

### バックアップの作成

```bash
# 完全バックアップ
npm run backup

# クリティカルテーブルのみのバックアップ
npm run backup -- --critical

# バックアップの説明を追加
npm run backup -- --description="マイルストーン1完了後のバックアップ"
```

### バックアップからの復元

```bash
# 特定のバックアップファイルから復元
npm run restore -- --file=backup_2023-04-10.json

# 復元前にテーブルをクリア
npm run restore -- --file=backup_2023-04-10.json --clear

# 特定のテーブルのみを復元
npm run restore -- --file=backup_2023-04-10.json --tables=conversation_histories,bot_settings
```

## Supabaseデータベースモデル

このボットは以下のテーブルを使用します：

- `conversation_histories` - ユーザーごとの会話履歴
- `api_usage` - API使用量のトラッキング
- `bot_settings` - ボットの設定情報
- `system_logs` - システムログ
- `api_logs` - API呼び出しログ
- `env_variables` - 環境変数の保存
- `bot_status` - ボットの状態情報

## Railway へのデプロイ

このプロジェクトは Railway へのデプロイに最適化されています：

1. Railway アカウントで新規プロジェクトを作成
2. GitHub リポジトリをソースとして選択
3. 必要な環境変数を設定
4. デプロイを開始

Railway の CI/CD パイプラインにより、自動的にビルドとデプロイが行われます。

## ライセンス

[MIT](LICENSE)

## コントリビューション

プルリクエストや課題の報告を歓迎します。大きな変更を行う場合は、まず課題を開いて議論してください。

## 作者

- **botarhythm** - 初期開発者
