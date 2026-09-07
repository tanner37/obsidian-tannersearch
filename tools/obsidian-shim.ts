export class TFile {
  path: string
  basename: string
  stat = { mtime: 1 }
  constructor(path: string) {
    this.path = path
    this.basename = path.split('/').pop()!.replace(/\.md$/, '')
  }
}
export class Notice { constructor(..._args: unknown[]) {} }
export class MarkdownView {}
export const Platform = { isMacOS: false }
export const getAllTags = (metadata: any) => metadata?.tags ?? []
export const parseFrontMatterAliases = (frontmatter: any) => frontmatter?.aliases ?? []
export const normalizePath = (value: string) => value.replaceAll('\\', '/')
