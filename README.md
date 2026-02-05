# Tannersearch for Obsidian

This is a fork of [obsidian-omnisearch](https://github.com/scambier/obsidian-omnisearch) by [@scambier](https://github.com/scambier) with the following changes:

- when opening a result, the cursor placement offset prioritizes note titles, headings, then content
  - this means if the note's name matches your search, it opens at the top
- search terms aren't split on apostrophes
  - searching for "Sun's BBQ" searches for ["Sun's", "BBQ"] instead of ["Sun", "s", "BBQ"]
- searches aren't HTML escaped
  - before searching for "Sun's BBQ" would actually search for `Sun&#039;s BBQ`
- search terms less than 3 characters long or common words are ignored
  - ignored words: "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "by", "for", "with", "to", "from", "of", "is", "it", "that", "this"
- the first line of a paragraph is ranked like Heading 3 if it ends in a colon
  - for example,

```
Japan trip:
- passport
- cash
- umbrella
```

... "Japan trip:" is indexed and ranked the same as "### Japan trip"



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
