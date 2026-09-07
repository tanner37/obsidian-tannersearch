#!/usr/bin/env node

/**
 * Small terminal harness for exercising the search experience without Obsidian.
 * It intentionally uses only Node's standard library so it can be run from a
 * checkout with: npm run tui [directory]
 */
const fs = require('node:fs')
const path = require('node:path')
const MiniSearch = require('minisearch')

const DEFAULT_DIRECTORY = path.resolve(__dirname, '..', 'tests', 'notes')
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'by', 'for',
  'with', 'to', 'from', 'of', 'is', 'it', 'that', 'this',
])
const ANSI = {
  clear: '\x1b[2J\x1b[H',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  inverse: '\x1b[7m',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  reset: '\x1b[0m',
}

function walk(directory) {
  const notes = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) notes.push(...walk(filePath))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) notes.push(filePath)
  }
  return notes
}

function removeDiacritics(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').normalize('NFC')
}

// Mirrors the plugin's indexing tokenizer. In particular, apostrophes are
// preserved as part of a token rather than being treated as separators.
function tokenize(text) {
  return text
    .split(/[|\[\]()<>{} \t\n\r]+/u)
    .flatMap(word => [word, ...word.split(/[.,:;!?/\\_#%&*=^@-]+/u)])
    .filter(Boolean)
}

function processTerm(term) {
  const processed = removeDiacritics(term).toLowerCase()
  return processed.length < 3 || STOP_WORDS.has(processed) ? null : processed
}

function headingFields(text) {
  const lines = text.split(/\r?\n/)
  const fields = { headings1: [], headings2: [], headings3: [], markdownHeadings: [] }
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!match) continue
    const level = match[1].length
    if (level <= 3) fields[`headings${level}`].push(match[2])
    fields.markdownHeadings.push(match[2])
  }
  // Match DocumentsRepository's colon-heading promotion rule.
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    const previous = index > 0 ? lines[index - 1].trim() : null
    const next = index < lines.length - 1 ? lines[index + 1].trim() : null
    if (line.endsWith(':') && previous === '' && next !== null && next !== '') {
      fields.headings3.push(line.slice(0, -1).trim())
    }
  }
  return fields
}

function buildIndex(notes) {
  const index = new MiniSearch({
    idField: 'path',
    fields: ['basename', 'directory', 'aliases', 'content', 'headings1', 'headings2', 'headings3'],
    tokenize,
    processTerm,
  })
  index.addAll(notes.map(note => {
    const fields = headingFields(note.text)
    return {
      path: note.path,
      basename: note.basename,
      directory: path.dirname(note.relative),
      aliases: '',
      content: note.text,
      headings1: fields.headings1.join(' '),
      headings2: fields.headings2.join(' '),
      headings3: fields.headings3.join(' '),
    }
  }))
  return index
}

function search(index, notesByPath, query) {
  const terms = tokenize(query).map(processTerm).filter(Boolean)
  if (!terms.length) return []
  const results = index.search(terms.join(' '), {
    prefix: term => term.length >= 1,
    bm25: { b: 0.2, d: 0.5, k: 1.2 },
    fuzzy: term => term.length <= 4 ? 0 : term.length <= 5 ? 0.05 : 0.1,
    boost: { basename: 10, directory: 7, headings1: 6, headings2: 5, headings3: 4 },
  })
  return results.map(result => {
    const note = notesByPath.get(result.id)
    const lower = note.text.toLocaleLowerCase()
    const fields = headingFields(note.text)
    const titleTerm = terms.find(term => note.basename.toLocaleLowerCase().includes(term))
    const headingTerm = result.terms.find(term => fields.markdownHeadings.some(heading => heading.toLowerCase().includes(term)))
    const offset = titleTerm ? 0 : headingTerm
      ? lower.indexOf(headingTerm)
      : Math.max(0, lower.indexOf(result.terms[0] || terms[0]))
    return { note, terms: result.terms.length ? result.terms : terms, score: result.score, offset }
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function htmlExcerptToTerminal(html) {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, `${ANSI.yellow}${ANSI.bold}$1${ANSI.reset}${ANSI.dim}`)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
  const unindented = text.split('\n').map(line => line.replace(/^\s+/, ''))
  return ANSI.dim + unindented.slice(0, 3).join('\n') + ANSI.reset
}

function highlight(text, terms, restore = '') {
  if (!terms.length) return text
  const expression = new RegExp(`(${terms.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`, 'giu')
  return text.replace(expression, `${ANSI.yellow}${ANSI.bold}$1${ANSI.reset}${restore}`)
}

// Use the exact matches returned by TextProcessor rather than MiniSearch's
// terms. This preserves complete matches such as "OCD" and "OCD's".
function highlightMatches(text, matches, additionalTerms = []) {
  const terms = [...new Set([
    ...matches.map(match => match.match),
    ...additionalTerms,
  ])].sort((a, b) => b.length - a.length)
  if (!terms.length) return text
  const expression = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu')
  return text.replace(expression, `${ANSI.yellow}${ANSI.bold}$1${ANSI.reset}${ANSI.dim}`)
}

function excerpt(note, result) {
  // Obsidian's result preview is short and keeps the note's line breaks.
  const lines = note.text.split(/\r?\n/)
  let offset = 0
  let matchLine = 0
  for (let index = 0; index < lines.length; index++) {
    if (result.offset <= offset + lines[index].length) {
      matchLine = index
      break
    }
    offset += lines[index].length + 1
  }
  const firstLine = Math.max(0, matchLine - 1)
  const lastLine = Math.min(lines.length, firstLine + 3)
  const visible = lines.slice(firstLine, lastLine)
  const prefix = firstLine ? '…' : ''
  const suffix = lastLine < lines.length ? '…' : ''
  return ANSI.dim + prefix + visible.map(line => highlight(line, result.terms, ANSI.dim)).join('\n') + suffix + ANSI.reset
}

function loadNotes(directory) {
  return walk(directory).map(filePath => ({
    path: filePath,
    basename: path.basename(filePath, '.md'),
    relative: path.relative(directory, filePath),
    text: fs.readFileSync(filePath, 'utf8'),
  }))
}

class SearchTUI {
  constructor(directory) {
    this.directory = directory
    this.pluginSearch = null
    this.searchGeneration = 0
    this.notes = loadNotes(directory)
    this.notesByPath = new Map(this.notes.map(note => [note.path, note]))
    this.index = buildIndex(this.notes)
    this.query = ''
    this.results = []
    this.selected = 0
    this.scrollOffset = 0
    this.mode = 'search'
    this.openResult = null
    this.noteScrollLine = 0
  }

  async init() {
    if (process.env.TUI_PLUGIN_SEARCH) {
      const { createPluginSearch } = require(process.env.TUI_PLUGIN_SEARCH)
      this.pluginSearch = await createPluginSearch(this.notes.map(note => ({
        path: note.relative,
        basename: note.basename,
        text: note.text,
      })))
    }
    return this
  }

  start() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('The search TUI requires an interactive terminal (TTY).')
    }
    process.stdin.setRawMode(true)
    process.stdout.write(ANSI.hideCursor)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', key => this.onKey(key))
    this.render()
  }

  stop() {
    process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdin.removeAllListeners('data')
    // DocumentsRepository owns a repeating cache timer, so merely pausing
    // stdin leaves the process alive. Restore the terminal and exit explicitly.
    process.stdout.write(`${ANSI.showCursor}\n`)
    process.exit(0)
  }

  onKey(key) {
    if (key === '\u0003') return this.stop() // Ctrl-C
    if (this.mode === 'note') {
      if (key === 'q' || key === '\u001b' || key === '\u001b\u001b') {
        this.mode = 'search'
        this.render()
      } else if (key === '\u001b[A') {
        this.noteScrollLine = Math.max(0, this.noteScrollLine - 1)
        this.render()
      } else if (key === '\u001b[B') {
        this.noteScrollLine += 1
        this.ensureNoteScrollBounds()
        this.render()
      } else if (key === '\u001b[5~') {
        this.noteScrollLine = Math.max(0, this.noteScrollLine - this.visibleNoteLines())
        this.render()
      } else if (key === '\u001b[6~') {
        this.noteScrollLine += this.visibleNoteLines()
        this.ensureNoteScrollBounds()
        this.render()
      } else if (key === '\u001b[H' || key === '\u001b[1~') {
        this.noteScrollLine = 0
        this.render()
      } else if (key === '\u001b[F' || key === '\u001b[4~') {
        this.noteScrollLine = Number.MAX_SAFE_INTEGER
        this.ensureNoteScrollBounds()
        this.render()
      }
      return
    }
    if (key === '\u0008' || key === '\u007f') {
      this.query = this.query.slice(0, -1)
      this.updateResults()
    } else if (key === '\r' || key === '\n') {
      if (this.results.length) {
        this.openResult = this.results[this.selected]
        this.mode = 'note'
        this.noteScrollLine = 0
        this.ensureNoteCursorVisible()
        this.render()
      }
    } else if (key === '\u001b[A') {
      this.selected = Math.max(0, this.selected - 1)
      this.ensureSelectionVisible()
      this.render()
    } else if (key === '\u001b[B') {
      this.selected = Math.min(Math.max(0, this.results.length - 1), this.selected + 1)
      this.ensureSelectionVisible()
      this.render()
    } else if (key === '\u001b[5~') {
      this.selected = Math.max(0, this.selected - this.visibleResultCount())
      this.ensureSelectionVisible()
      this.render()
    } else if (key === '\u001b[6~') {
      this.selected = Math.min(Math.max(0, this.results.length - 1), this.selected + this.visibleResultCount())
      this.ensureSelectionVisible()
      this.render()
    } else if (key === '\u001b[H' || key === '\u001b[1~') {
      this.selected = 0
      this.ensureSelectionVisible()
      this.render()
    } else if (key === '\u001b[F' || key === '\u001b[4~') {
      this.selected = Math.max(0, this.results.length - 1)
      this.ensureSelectionVisible()
      this.render()
    } else if (key === '\u001b') {
      this.query = ''
      this.updateResults()
    } else if (key >= ' ' && key !== '\u007f') {
      this.query += key
      this.updateResults()
    }
  }

  visibleNoteLines() {
    return Math.max(1, (process.stdout.rows || 24) - 6)
  }

  noteCursorPosition() {
    if (!this.openResult) return { line: 0, column: 0 }
    let remaining = this.openResult.offset
    const lines = this.openResult.note.text.split(/\r?\n/)
    for (let line = 0; line < lines.length; line++) {
      if (remaining <= lines[line].length) return { line, column: Math.max(0, remaining) }
      remaining -= lines[line].length + 1
    }
    return { line: lines.length - 1, column: lines.at(-1)?.length ?? 0 }
  }

  ensureNoteScrollBounds() {
    if (!this.openResult) return
    const lineCount = this.openResult.note.text.split(/\r?\n/).length
    this.noteScrollLine = Math.max(0, Math.min(this.noteScrollLine, Math.max(0, lineCount - this.visibleNoteLines())))
  }

  ensureNoteCursorVisible() {
    const cursor = this.noteCursorPosition()
    const visible = this.visibleNoteLines()
    this.noteScrollLine = cursor.line - Math.floor(visible / 2)
    this.ensureNoteScrollBounds()
  }

  visibleResultCount() {
    // Each result occupies a title line, three excerpt lines, and a spacer.
    // Keep the header and help text visible while scrolling.
    return Math.max(1, Math.floor(((process.stdout.rows || 24) - 6) / 5))
  }

  ensureSelectionVisible() {
    const visible = this.visibleResultCount()
    if (this.selected < this.scrollOffset) this.scrollOffset = this.selected
    if (this.selected >= this.scrollOffset + visible) {
      this.scrollOffset = this.selected - visible + 1
    }
    this.scrollOffset = Math.max(0, Math.min(
      this.scrollOffset,
      Math.max(0, this.results.length - visible),
    ))
  }

  async updateResults() {
    const generation = ++this.searchGeneration
    if (this.pluginSearch) {
      const ranked = await this.pluginSearch(this.query)
      if (generation !== this.searchGeneration) return
      this.results = ranked.map(result => {
        const note = this.notes.find(candidate => candidate.relative === result.id)
        return {
          note,
          terms: result.terms,
          matches: result.matches,
          score: result.score,
          offset: result.offset,
          excerpt: highlightMatches(
            htmlExcerptToTerminal(result.excerpt),
            result.matches,
            result.terms,
          ),
        }
      }).filter(result => result.note)
    } else {
      this.results = search(this.index, this.notesByPath, this.query)
    }
    this.selected = Math.min(this.selected, Math.max(0, this.results.length - 1))
    this.ensureSelectionVisible()
    this.render()
  }

  render() {
    process.stdout.write(ANSI.clear)
    if (this.mode === 'note') return this.renderNote()
    process.stdout.write(`${ANSI.bold}${ANSI.cyan}Tannersearch TUI${ANSI.reset}  ${ANSI.dim}${this.directory}${ANSI.reset}\n\n`)
    process.stdout.write(`${ANSI.bold}Search:${ANSI.reset} ${this.query}${ANSI.cyan}▌${ANSI.reset}\n`)
    process.stdout.write(`${ANSI.dim}Type to search · ↑/↓ select · Enter open · Esc clear · Ctrl-C quit${ANSI.reset}\n\n`)
    if (!this.query) {
      process.stdout.write(`${ANSI.dim}Start typing to search ${this.notes.length} Markdown notes.${ANSI.reset}\n`)
      return
    }
    if (!this.results.length) {
      process.stdout.write(`${ANSI.yellow}No matching notes.${ANSI.reset}\n`)
      return
    }
    const visible = this.visibleResultCount()
    this.ensureSelectionVisible()
    const shown = this.results.slice(this.scrollOffset, this.scrollOffset + visible)
    shown.forEach((result, visibleIndex) => {
      const index = this.scrollOffset + visibleIndex
      const marker = index === this.selected ? `${ANSI.inverse}>${ANSI.reset}` : ' '
      process.stdout.write(`${marker} ${ANSI.bold}${result.note.basename}${ANSI.reset} ${ANSI.dim}(${result.note.relative})${ANSI.reset}\n`)
      process.stdout.write(`${result.excerpt || excerpt(result.note, result)}\n\n`)
    })
    if (this.results.length > visible) {
      process.stdout.write(`${ANSI.dim}Showing ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + visible, this.results.length)} of ${this.results.length} · PageUp/PageDown to scroll${ANSI.reset}\n`)
    }
  }

  renderNote() {
    const result = this.openResult
    const note = result.note
    process.stdout.write(`${ANSI.bold}${ANSI.green}${note.basename}${ANSI.reset} ${ANSI.dim}— fake cursor at match${ANSI.reset}\n`)
    process.stdout.write(`${ANSI.dim}Press q or Esc to return to results.${ANSI.reset}\n\n`)
    const lines = note.text.split(/\r?\n/)
    const cursor = this.noteCursorPosition()
    const visible = lines.slice(this.noteScrollLine, this.noteScrollLine + this.visibleNoteLines())
    visible.forEach((line, index) => {
      const lineNumber = this.noteScrollLine + index
      if (lineNumber === cursor.line) {
        process.stdout.write(`${highlight(line.slice(0, cursor.column), result.terms)}${ANSI.green}▌${ANSI.reset}${highlight(line.slice(cursor.column), result.terms)}\n`)
        process.stdout.write(`${' '.repeat(cursor.column)}${ANSI.green}^ cursor${ANSI.reset}\n`)
      } else {
        process.stdout.write(`${highlight(line, result.terms)}\n`)
      }
    })
  }
}

const directory = path.resolve(process.argv[2] || DEFAULT_DIRECTORY)
try {
  if (!fs.statSync(directory).isDirectory()) throw new Error(`Not a directory: ${directory}`)
  new SearchTUI(directory).init().then(tui => tui.start())
} catch (error) {
  console.error(`search-tui: ${error.message}`)
  process.exitCode = 1
}
