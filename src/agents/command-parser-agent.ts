/**
 * コマンドパーサーエージェント
 */

import config from '../config';

interface ParsedCommand {
  command: string;
  args: string;
}

const CommandParserAgent = {
  /**
   * メッセージからコマンドを解析する
   * @param message - ユーザーメッセージ
   * @returns パースされたコマンド
   */
  async process(message: string): Promise<ParsedCommand> {
    try {
      const prefix = config.discord.prefix || '!';
      
      // メッセージがコマンド形式か確認
      if (!message.startsWith(prefix)) {
        return {
          command: 'chatDefault',
          args: message
        };
      }
      
      // プレフィックスを除去し、最初の空白でコマンドと引数を分離
      const content = message.slice(prefix.length).trim();
      const args = content.split(' ');
      const command = args.shift()?.toLowerCase() || '';
      const restArgs = args.join(' ');
      
      // コマンドに基づいて処理を分岐
      switch (command) {
        case 'search':
        case 'find':
        case 's':
          // 検索コマンド
          if (!restArgs) {
            return {
              command: 'chatDefault',
              args: `検索したい内容を教えてください。使い方: ${prefix}search [検索キーワード]`
            };
          }
          return {
            command: 'webSearch',
            args: restArgs
          };
          
        case 'help':
        case 'h':
        case '?':
          // ヘルプコマンド
          return {
            command: 'help',
            args: restArgs
          };
          
        case 'clear':
        case 'reset':
        case 'c':
          // 会話履歴クリアコマンド
          return {
            command: 'clearChat',
            args: ''
          };
          
        case 'image':
        case 'img':
        case 'i':
          // 画像生成コマンド（将来対応予定）
          return {
            command: 'generateImage',
            args: restArgs
          };
          
        default:
          // 認識できないコマンドはチャットとして処理
          return {
            command: 'chatDefault',
            args: message
          };
      }
    } catch (error) {
      console.error('Command parsing error:', error);
      return {
        command: 'chatDefault',
        args: message
      };
    }
  }
};

export default CommandParserAgent;
