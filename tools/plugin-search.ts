import { Query } from '../src/search/query'
import { SearchEngine } from '../src/search/search-engine'
import { DocumentsRepository } from '../src/repositories/documents-repository'
import { TFile } from 'obsidian'
import { TextProcessor } from '../src/tools/text-processing'
import type { IndexedDocument } from '../src/globals'

type Note = { path: string; basename: string; text: string }

const defaults: any = {
  fuzziness: '1', weightBasename: 10, weightDirectory: 7, weightH1: 6,
  weightH2: 5, weightH3: 4, weightH4: 3, weightColonHeadings: 2, weightUnmarkedTags: 2, recencyBoost: '0',
  downrankedFoldersFilters: [], hideExcluded: false, weightCustomProperties: [],
  ignoreDiacritics: true, ignoreArabicDiacritics: false, simpleSearch: false,
  maxEmbeds: 5, renderLineReturnInExcerpts: true, highlight: true,
}

function indexDocument(note: Note): IndexedDocument {
  const lines = note.text.split('\n')
  const headings1: string[] = [], headings2: string[] = [], headings3: string[] = []
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (match && match[1].length <= 3) {
      ;[headings1, headings2, headings3][match[1].length - 1].push(match[2])
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const previous = i > 0 ? lines[i - 1].trim() : null
    const next = i < lines.length - 1 ? lines[i + 1].trim() : null
    if (line.endsWith(':') && previous === '' && next !== null && next !== '') {
      headings3.push(line.slice(0, -1).trim())
    }
  }
  return {
    path: note.path, basename: note.basename, displayTitle: '', mtime: 1,
    content: note.text, cleanedContent: note.text, aliases: '', tags: [],
    unmarkedTags: [], headings1: headings1.join(' '), headings2: headings2.join(' '),
    headings3: headings3.join(' '), headings4: '', colonHeadings: '',
  }
}

export async function createPluginSearch(notes: Note[]) {
  const noteMap = new Map(notes.map(note => [note.path, note]))
  const metadata = new Map(notes.map(note => [note.path, {
    headings: note.text.split('\n').flatMap((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
      return match ? [{ level: match[1].length, heading: match[2], position: {
        start: { offset: note.text.split('\n').slice(0, index).join('\n').length + (index ? 1 : 0) },
        end: { offset: note.text.length },
      } }] : []
    }),
    links: [],
  }]))
  const plugin: any = {
    settings: defaults,
    app: {
      vault: {
        getAbstractFileByPath: (path: string) => new (TFile as any)(path),
        cachedRead: async (file: TFile) => noteMap.get(file.path)?.text ?? '',
      },
      metadataCache: {
        getCache: (path: string) => metadata.get(path),
        getFileCache: (file: TFile) => metadata.get(file.path),
        isUserIgnored: () => false,
      },
    },
    notesIndexer: { isFilePlaintext: () => true, isFilenameIndexable: () => true },
    getChsSegmenter: () => undefined,
    getTextExtractor: () => undefined,
    getAIImageAnalyzer: () => undefined,
    embedsRepository: { refreshEmbedsForNote: () => undefined, getEmbeds: () => [] },
  }
  plugin.textProcessor = new TextProcessor(plugin)
  plugin.documentsRepository = new DocumentsRepository(plugin)
  const engine = new SearchEngine(plugin)
  await engine.addFromPaths(notes.map(note => note.path))
  return async (text: string) => {
    const query = new Query(text, { ignoreDiacritics: true, ignoreArabicDiacritics: false })
    const results = await engine.getSuggestions(query)
    return results.map(result => {
      const offset = result.matches[0]?.offset ?? -1
      const excerpt = plugin.textProcessor.makeExcerpt(result.content, offset)
      return {
        id: result.path,
        terms: result.foundWords,
        matches: result.matches,
        score: result.score,
        offset,
        excerpt,
      }
    })
  }
}
