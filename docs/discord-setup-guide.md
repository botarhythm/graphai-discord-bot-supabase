# Discord開発者ポータル設定ガイド

このガイドでは、Discord開発者ポータルでボットが正しく機能するために必要な設定について説明します。
特にDMとメンションの応答問題に対処するための設定に焦点を当てています。

## 必要な設定

### 1. インテント設定

Discord開発者ポータルで以下のインテントが有効になっていることを確認します：

1. **MESSAGE CONTENT INTENT** - メッセージ内容の閲覧に必要
2. **SERVER MEMBERS INTENT** - サーバーメンバー情報の取得に必要
3. **PRESENCE INTENT** - オプション（必要な場合のみ）

![インテント設定](https://raw.githubusercontent.com/botarhythm/graphai-discord-bot-supabase/main/docs/images/intents.png)

### 2. ボット設定

以下のボット設定が有効になっていることを確認します：

1. **PUBLIC BOT** - 他のサーバーに追加可能にする場合はオン
2. **REQUIRES OAUTH2 CODE GRANT** - 通常はオフ
3. **PRESENCE INTENT** - ユーザーのプレゼンス情報を取得する場合はオン

### 3. 権限設定

ボットが正しく機能するために必要な最小限の権限：

- **READ MESSAGES/VIEW CHANNELS** - チャンネルとメッセージの閲覧
- **SEND MESSAGES** - メッセージの送信
- **SEND MESSAGES IN THREADS** - スレッドでのメッセージ送信
- **EMBED LINKS** - リンクの埋め込み
- **ATTACH FILES** - ファイルの添付（必要な場合）
- **READ MESSAGE HISTORY** - メッセージ履歴の閲覧
- **MENTION EVERYONE** - @everyone, @here, 全ロールのメンション（必要な場合）
- **USE EXTERNAL EMOJIS** - 外部絵文字の使用（必要な場合）
- **ADD REACTIONS** - リアクションの追加（必要な場合）

### 4. OAuth2 URL生成

ボットをサーバーに追加する際のOAuth2 URLに、必要な権限が含まれていることを確認します：

1. **bot** スコープを選択
2. 必要な権限をすべて選択
3. 生成されたURLを使用してボットをサーバーに追加

## DMに関する設定

DMを受信・送信するには以下が必要です：

1. **DIRECT MESSAGES INTENT** がコード内で設定されていること
2. `Partials.Channel`, `Partials.Message`, `Partials.User` が設定されていること
3. ボット初期化時にこれらの設定が正しく行われていること

## トラブルシューティング

DMやメンションに応答しない場合の確認事項：

1. ボットが適切なインテントで初期化されているか
2. Discord開発者ポータルでインテントが有効化されているか
3. ボットに適切な権限が付与されているか
4. メッセージ処理コードがDMとメンションを正しく検知しているか
5. デバッグログに何らかのエラーが記録されているか

## デバッグスクリプトの実行

当リポジトリには診断用のスクリプトが含まれています：

```bash
# DMとメンション応答のデバッグ
npm run debug:dm

# ボットの一般的な診断
npm run diagnose
```

これらのスクリプトはログを生成し、問題の特定に役立ちます。

---

問題が解決しない場合は、生成されたログファイル（`dm-debug.log`および`bot-fix.log`）を確認し、
具体的なエラーメッセージに基づいて対処してください。
