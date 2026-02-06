# Tannersearch for Obsidian

This is a fork of [obsidian-omnisearch](https://github.com/scambier/obsidian-omnisearch) (by [@scambier](https://github.com/scambier)) with the following changes:

When opening a result, the cursor placement prioritizes note titles over headings over content
- this means if the note's name matches your search, it opens at the top instead of on a random match in the middle of the note

Search terms aren't split on apostrophes
- searching for "Sun's BBQ" searches for ["Sun's", "BBQ"] instead of ["Sun", "s", "BBQ"]

Search terms less than 3 characters long or common words are ignored
- ignored words: "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "by", "for", "with", "to", "from", "of", "is", "it", "that", "this"

The first line of a paragraph is ranked like Heading 3 if it ends in a colon
- for example,

```
Japan trip:
- passport
- cash
- umbrella
```

... "Japan trip:" is indexed and ranked the same as "### Japan trip"

If the first paragraph of a note contains a line like "aka other name", then "other name" is ranked like H1
- for example,

```
see also: [[Travel General]]
Aka: packing list

content
```

... "packing list" is indexed and ranked the same as "# packing list". Note that "Aka:" isn't case or colon sensitive.


### Fork Installation

Ensure the original Omnisearch plugin is installed, see instructions below.

Download main.js into your `.obsidian/plugins/omnisearch` directory, example:

```
$ cd ~/notes/.obsidian/plugins/omnisearch
$ mv main.js main.js.bak
$ wget https://raw.githubusercontent.com/tanner37/obsidian-tannersearch/refs/heads/master/dist/main.js
```

In Obsidian, open Settings > Community Plugings. Disable and enable Omnisearch.

Open Settings > Omnisearch. Scroll to bottom. Click "Clear cache" data.

Restart Obsidian.

Note: on mobile you'll have to use some sort of sync or downloader and move the main.js over to your vault.

### Building the Fork

If you'd rather build the fork yourself:

```
$ git clone https://github.com/tanner37/obsidian-tannersearch.git
$ cd obsidian-tannersearch/
$ npm install --legacy-peer-deps
$ npm run build
```

Then copy `dist/main.js` as above.



# Original README

**Omnisearch** is a search engine that "_just works_".  
It always instantly shows you the most relevant results, thanks to its smart weighting algorithm.

Under the hood, it uses the excellent [MiniSearch](https://github.com/lucaong/minisearch) library. This free plugin is totally unrelated to the omnisearch.ai paid product.

## Documentation

https://publish.obsidian.md/omnisearch/Index

## Installation

- Omnisearch is available on [the official Community Plugins repository](https://obsidian.md/plugins?search=Omnisearch).
- Beta releases can be installed through [BRAT](https://github.com/TfTHacker/obsidian42-brat). **Be advised that those
  versions can be buggy and break things.**

You can check the [CHANGELOG](./CHANGELOG.md) for more information on the different versions.

## Features

> Omnisearch's first goal is to _locate_ files instantly. You can see it as a _Quick Switcher_ on steroids.

- Find your **📝notes, 📄Office documents, 📄PDFs, and 🖼images** faster than ever
  - Images, documents, and PDF indexing is available
    through [Text Extractor](https://github.com/scambier/obsidian-text-extractor)
- Automatic document scoring using
  the [BM25 algorithm](https://github.com/lucaong/minisearch/issues/129#issuecomment-1046257399)
  - The relevance of a document against a query depends on the number of times the query terms appear in the document,
    its filename, and its headings
- Keyboard first: you never have to use your mouse
- Workflow similar to the "Quick Switcher" core plugin
- Opt-in local HTTP server to query Omnisearch from outside of Obsidian
- Resistance to typos
- Switch between Vault and In-file search to quickly skim multiple results in a single note
- Supports `"expressions in quotes"` and `-exclusions`
- Filters file types with `.jpg` or `.md`
- Directly Insert a `[[link]]` from the search results
- Supports Vim navigation keys

**Note:** support of Chinese depends
on [this additional plugin](https://github.com/aidenlx/cm-chs-patch) (also you may need to clear search cache data to apply new Chinese index). Please read its documentation for more
information.

## Projects that use Omnisearch

_Submit a PR to add your own project!_

- [Omnisearch Companion](https://github.com/ALegendsTale/omnisearch-companion), an extension for your browser ([Firefox](https://addons.mozilla.org/en-US/firefox/addon/omnisearch-companion/), [Chrome](https://chromewebstore.google.com/detail/omnisearch-companion/kcjcnnlpfbilodfnnkpioijobpjhokkd))
- [Actions for Obsidian](https://actions.work/actions-for-obsidian)
- [Notebook Navigator](https://notebooknavigator.com/)
- [Userscripts](https://publish.obsidian.md/omnisearch/Inject+Omnisearch+results+into+your+search+engine) to inject Omnisearch into your favorite web search engine

## LICENSE

Omnisearch is licensed under [GPL-3](https://tldrlegal.com/license/gnu-general-public-license-v3-(gpl-3)).

## Thanks

To all people who donate through [Ko-Fi](https://ko-fi.com/scambier)
or [Github Sponsors](https://github.com/sponsors/scambier) ❤
