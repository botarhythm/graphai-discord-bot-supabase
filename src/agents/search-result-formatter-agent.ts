/**
 * 検索結果フォーマッターエージェント
 */

interface SearchResult {
  query: string;
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
    }>;
    [key: string]: any;
  };
  error?: boolean;
  message?: string;
}

const SearchResultFormatterAgent = {
  /**
   * 検索結果をフォーマットする
   * @param searchResults - 検索結果オブジェクト
   * @returns フォーマットされた検索結果テキスト
   */
  async process(searchResults: SearchResult): Promise<string> {
    try {
      // エラーチェック
      if (searchResults.error) {
        return `検索中にエラーが発生しました: ${searchResults.message || '不明なエラー'}`;
      }
      
      // 検索結果が空の場合
      if (!searchResults.web || !searchResults.web.results || searchResults.web.results.length === 0) {
        return `「${searchResults.query}」に一致する検索結果が見つかりませんでした。別のキーワードで試してみてください。`;
      }
      
      // 検索結果をマークダウン形式でフォーマット
      let formattedText = `## 「${searchResults.query}」の検索結果:\n\n`;
      
      // 結果一覧
      searchResults.web.results.forEach((result, index) => {
        formattedText += `### ${index + 1}. [${result.title}](${result.url})\n`;
        formattedText += `${result.description || '説明なし'}\n\n`;
      });
      
      // フッター
      formattedText += `---\n*Brave Searchによる検索結果（${searchResults.web.results.length}件）*\n`;
      
      return formattedText;
    } catch (error: any) {
      console.error('Error formatting search results:', error);
      return `検索結果のフォーマット中にエラーが発生しました: ${error.message || error}`;
    }
  }
};

export default SearchResultFormatterAgent;
