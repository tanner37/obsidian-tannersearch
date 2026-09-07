#!/usr/bin/env node
const os = require('node:os')
const path = require('node:path')
const { buildSync } = require('esbuild')

const output = path.join(os.tmpdir(), `tannersearch-plugin-search-${process.pid}.cjs`)
buildSync({
  entryPoints: [path.join(__dirname, 'plugin-search.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: output,
  alias: { obsidian: path.join(__dirname, 'obsidian-shim.ts') },
  logLevel: 'silent',
})
process.env.TUI_PLUGIN_SEARCH = output
require('./search-tui.js')
