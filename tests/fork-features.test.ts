import fs from 'node:fs'
import path from 'node:path'

jest.mock('markdown-link-extractor', () => () => [])
jest.mock('obsidian', () => {
  const nodePath = require('node:path')
  class TFile {
    path = ''
    basename = ''
    stat = { mtime: 1 }
    constructor(filePath: string) {
      this.path = filePath
      this.basename = nodePath.basename(filePath, nodePath.extname(filePath))
    }
  }

  return {
    TFile,
    Notice: jest.fn(),
    Platform: { isMacOS: false },
    normalizePath: (value: string) => value.replaceAll('\\', '/'),
    getAllTags: (metadata: any) => metadata?.tags ?? [],
    parseFrontMatterAliases: (frontmatter: any) => frontmatter?.aliases ?? [],
  }
})

import { Query } from '../src/search/query'
import { Tokenizer } from '../src/search/tokenizer'
import { TextProcessor } from '../src/tools/text-processing'
import { removeDiacritics } from '../src/tools/utils'
import { DocumentsRepository } from '../src/repositories/documents-repository'

const notesDir = path.join(__dirname, 'notes')
const readNote = (name: string) =>
  fs.readFileSync(path.join(notesDir, name), 'utf8')

const pluginFor = (overrides: Record<string, unknown> = {}) => ({
  settings: {
    highlight: true,
    ignoreDiacritics: true,
    ignoreArabicDiacritics: false,
    renderLineReturnInExcerpts: false,
    ...overrides,
  },
  getChsSegmenter: () => undefined,
} as any)

describe('fork search behavior', () => {
  test('keeps apostrophes together in a query and highlights them', () => {
    const query = new Query("Sun's BBQ", {
      ignoreDiacritics: false,
      ignoreArabicDiacritics: false,
    })
    expect(query.query.text).toEqual(["sun's", 'bbq'])

    const processor = new TextProcessor(pluginFor())
    const matches = processor.getMatches("Sun's BBQ", ["Sun's", 'BBQ'], query)
    expect(matches[0].match).toBe("Sun's BBQ")
    expect(processor.highlightText("Sun's BBQ", matches)).toContain(
      'omnisearch-highlight'
    )
    expect(processor.highlightText("Sun's BBQ", matches)).toContain("Sun's BBQ")
  })

  test('filters words shorter than three characters and the documented stop words', () => {
    const tokenizer = new Tokenizer(pluginFor())
    const result = tokenizer.tokenizeForSearch('a an the and or but if in on at by for with to from of is it that this useful') as any
    expect(result.queries.length).toBeGreaterThan(0)
    expect(result.queries.flatMap((query: any) => query.queries)).toContain('useful')
    for (const ignored of ['a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'by', 'for', 'with', 'to', 'from', 'of', 'is', 'it', 'that', 'this']) {
      expect(result.queries.flatMap((query: any) => query.queries)).not.toContain(ignored)
    }
    const onlyIgnored = tokenizer.tokenizeForSearch('x an') as any
    expect(onlyIgnored.queries.every((query: any) => query.queries.length === 0 || query.queries[0] === 'x an')).toBe(true)
  })

  test('matches diacritic-insensitive text and preserves the original match', () => {
    const processor = new TextProcessor(pluginFor())
    const matches = processor.getMatches('The café serves crème brûlée.', ['cafe', 'brulee'])
    expect(matches.map(match => match.match)).toEqual(['café', 'brûlée'])
    expect(removeDiacritics('café crème brûlée')).toBe('cafe creme brulee')
  })

  test('renders excerpts with blank lines as readable HTML', () => {
    const processor = new TextProcessor(pluginFor({ renderLineReturnInExcerpts: true }))
    const excerpt = processor.makeExcerpt(readNote('fork-features.md'), readNote('fork-features.md').indexOf('café'))
    expect(excerpt).toContain('<br>')
    expect(excerpt).not.toMatch(/<br>\s*<br>/)
    expect(excerpt).toContain('café')
  })
})

describe('indexed heading metadata', () => {
  test('indexes H1, H2, H3, and promotes only valid colon and AKA headings', async () => {
    const { TFile } = require('obsidian')
    const files = new Map<string, string>([
      ['tests/notes/headers-and-lists.md', readNote('headers-and-lists.md')],
      ['tests/notes/fork-features.md', readNote('fork-features.md')],
      ['tests/notes/colon-variants.md', readNote('colon-variants.md')],
      ['tests/notes/aka-variants.md', readNote('aka-variants.md')],
    ])
    const metadata = new Map<string, any>([
      ['tests/notes/headers-and-lists.md', { headings: [
        { level: 1, heading: 'H1 Heading' },
        { level: 2, heading: 'H2 Heading' },
        { level: 3, heading: 'H3 Heading' },
        { level: 4, heading: 'H4 Heading' },
        { level: 5, heading: 'H5 Heading' },
        { level: 6, heading: 'H6 Heading' },
      ] }],
      ['tests/notes/fork-features.md', { headings: [] }],
      ['tests/notes/colon-variants.md', { headings: [] }],
      ['tests/notes/aka-variants.md', { headings: [] }],
    ])
    const plugin = pluginFor({ indexedFileTypes: ['md'], unsupportedFilesIndexing: 'no' })
    plugin.notesIndexer = { isFilePlaintext: () => true, isFilenameIndexable: () => true }
    plugin.getTextExtractor = () => undefined
    plugin.getAIImageAnalyzer = () => undefined
    plugin.app = {
      vault: {
        getAbstractFileByPath: (filePath: string) => new TFile(filePath),
        cachedRead: async (file: any) => files.get(file.path),
      },
      metadataCache: {
        getFileCache: (file: any) => metadata.get(file.path),
      },
    }

    const repository = new DocumentsRepository(plugin)
    const getDocument = (repository as any).getAndMapIndexedDocument.bind(repository)
    const headings = await getDocument('tests/notes/headers-and-lists.md')
    expect(headings.headings1).toBe('H1 Heading')
    expect(headings.headings2).toBe('H2 Heading')
    expect(headings.headings3).toBe('H3 Heading')
    expect(headings.headings4).toBe('H4 Heading')

    const fork = await getDocument('tests/notes/fork-features.md')
    expect(fork.headings1).toBe('Packing List')
    expect(fork.headings3).toBe('')
    expect(fork.colonHeadings).toBe('Japan trip')

    const colon = await getDocument('tests/notes/colon-variants.md')
    expect(colon.headings3).toBe('')
    expect(colon.colonHeadings).toBe('Colon heading')

    const aka = await getDocument('tests/notes/aka-variants.md')
    expect(aka.headings1).toBe('lowercase alias')
  })
})
