import path from 'node:path'

export class TFile {
  path = ''
  basename = ''
  stat = { mtime: 1 }
  constructor(filePath = '') {
    this.path = filePath
    this.basename = path.basename(filePath, path.extname(filePath))
  }
}

export const Notice = jest.fn()
export const Platform = { isMacOS: false }
export const normalizePath = (value: string) => value.replaceAll('\\', '/')
export const getAllTags = (metadata: any) => metadata?.tags ?? []
export const parseFrontMatterAliases = (frontmatter: any) => {
  const aliases = frontmatter?.aliases
  if (!aliases) return []
  return Array.isArray(aliases)
    ? aliases
    : String(aliases).split(',').map(alias => alias.trim()).filter(Boolean)
}
