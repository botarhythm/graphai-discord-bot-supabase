/**
 * コンテンツ検出エージェント
 * メッセージの種類を検出し、適切な処理を選択するためのエージェント
 */

interface DetectionResult {
  hasImage: boolean;
  isWebSearchQuery: boolean;
  searchProbability?: number;
}

interface MessageContent {
  content: string;
  attachments?: any[];
}

const ContentDetectorAgent = {
  /**
   * メッセージの種類を検出する
   * @param message - ユーザーメッセージ
   * @returns 検出結果
   */
  async process(message: MessageContent): Promise<DetectionResult> {
    try {
      const result: DetectionResult = {
        hasImage: false,
        isWebSearchQuery: false
      };
      
      // 画像添付ファイルの検出
      if (message.attachments && message.attachments.length > 0) {
        const imageAttachments = message.attachments.filter((attachment: any) => {
          const url = attachment.url || '';
          const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
          return !!isImage;
        });
        
        result.hasImage = imageAttachments.length > 0;
      }
      
      // Web検索クエリの検出
      const content = message.content.trim();
      const searchPatterns = [
        /^(調べて|検索して|教えて|知りたい|何ですか|どうなっていますか|最近の|最新の|いつ|どこで|どのように|なぜ|どうやって)\s*.{3,}[？?]$/i,
        /^.{5,}\s*(とは|について|の意味|の定義|の使い方|の歴史|のやり方|の方法|の仕組み)[？?]$/i,
        /^(what|who|when|where|why|how)\s.{5,}\?$/i,
        /^.{5,}\s(news|latest|recent|update)/i,
        /^.{3,}\s(株価|価格|料金|レート|為替)/i,
      ];
      
      const searchProbability = searchPatterns.some(pattern => pattern.test(content)) ? 0.8 : 0.2;
      result.searchProbability = searchProbability;
      result.isWebSearchQuery = searchProbability > 0.6;
      
      return result;
    } catch (error) {
      console.error('Content detection error:', error);
      return {
        hasImage: false,
        isWebSearchQuery: false
      };
    }
  }
};

export default ContentDetectorAgent;
