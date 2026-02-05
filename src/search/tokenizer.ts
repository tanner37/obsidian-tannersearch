import type { Query, QueryCombination } from 'minisearch'
import { BRACKETS_AND_SPACE, chsRegex, SPACE_OR_PUNCTUATION } from '../globals'
import { logVerbose, splitCamelCase, splitHyphens } from '../tools/utils'
import type OmnisearchPlugin from '../main'

const markdownLinkExtractor = require('markdown-link-extractor')

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "by", "for", "with", "to", "from", "of", "is", "it", "that", "this"])

export class Tokenizer {
  constructor(private plugin: OmnisearchPlugin) {}

  /**
   * Tokenization for indexing will possibly return more tokens than the original text.
   * This is because we combine different methods of tokenization to get the best results.
   * @param text
   * @returns
   */
  public tokenizeForIndexing(text: string): string[] {
    try {
      const words = this.tokenizeWords(text)
      let urls: string[] = []
      if (this.plugin.settings.tokenizeUrls) {
        try {
          urls = markdownLinkExtractor(text)
        } catch (e) {
          logVerbose('Error extracting urls', e)
        }
      }

      let tokens = this.tokenizeTokens(text, { skipChs: true })
      tokens = [...tokens.flatMap(token => [
        token,
        ...splitHyphens(token),
        ...splitCamelCase(token),
      ]), ...words]

      // Add urls
      if (urls.length) {
        tokens = [...tokens, ...urls]
      }

      // Remove duplicates
      // tokens = [...new Set(tokens)]
      
      // Remove empty tokens
      tokens = tokens.filter(Boolean)

      return tokens
    } catch (e) {
      console.error('Error tokenizing text, skipping document', e)
      return []
    }
  }

  /**
   * Search tokenization will use the same tokenization methods as indexing,
   * but will combine each group with "OR" operators
   * @param text
   * @returns
   */
  public tokenizeForSearch(text: string): QueryCombination {
    // Extract urls and remove them from the query
    const urls: string[] = markdownLinkExtractor(text)
    const originalText = text
    text = urls.reduce((acc, url) => acc.replace(url, ''), text)

    const tokens = [...this.tokenizeTokens(text), ...urls].filter(Boolean)

    const isStopWord = (term: string): boolean => {
      const lower = term.toLowerCase()
      return lower.length < 3 || STOP_WORDS.has(lower)
    }

    const queries = [
      { combineWith: 'AND', queries: [originalText] },
      { combineWith: 'AND', queries: tokens },
      {
        combineWith: 'AND',
        queries: this.tokenizeWords(text).filter(Boolean),
      },
      { combineWith: 'AND', queries: tokens.flatMap(splitHyphens) },
      { combineWith: 'AND', queries: tokens.flatMap(splitCamelCase) },
    ].map(q => ({
      ...q,
      queries: q.queries.filter(t => !isStopWord(t)),
    }))

    const nonEmptyQueries = queries.filter(q => q.queries.length > 0)

    // Deduplicate
    const uniqueQueries = []
    const seen = new Set()
    for (const q of nonEmptyQueries) {
      // sort to make order irrelevant for duplication check
      const key = JSON.stringify(q.queries.sort())
      if (!seen.has(key)) {
        uniqueQueries.push(q)
        seen.add(key)
      }
    }

    return {
      combineWith: 'OR',
      queries: uniqueQueries as Query[],
    }
  }

  private tokenizeWords(text: string, { skipChs = false } = {}): string[] {
    const tokens = text.split(BRACKETS_AND_SPACE)
    if (skipChs) return tokens
    return this.tokenizeChsWord(tokens)
  }

  private tokenizeTokens(text: string, { skipChs = false } = {}): string[] {
    const tokens = text.split(SPACE_OR_PUNCTUATION)
    if (skipChs) return tokens
    return this.tokenizeChsWord(tokens)
  }

  private tokenizeChsWord(tokens: string[]): string[] {
    const segmenter = this.plugin.getChsSegmenter()
    if (!segmenter) return tokens
    return tokens.flatMap(word =>
      chsRegex.test(word) ? segmenter.cut(word, { search: true }) : [word]
    )
  }
}
