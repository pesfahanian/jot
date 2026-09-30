<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/tile-dark.svg">
    <img src="public/tile-light.svg" width="96" height="96" alt="jot">
  </picture>
</p>

<h1 align="center">jot</h1>

<p align="center">A quiet markdown editor that lives in your browser.<br><a href="https://jot.software">jot.software</a></p>

---

Open it and write. There's no account and no server. Your documents stay on your device.

## What it does

- Renders LaTeX math and Mermaid diagrams in the preview and in exported PDFs
- An optional AI style review that suggests edits and changes nothing until you say so

## Privacy

Everything is stored in your browser. The AI review is off until you add your own API key (OpenRouter, Google AI Studio, OpenAI or Anthropic), and it only sends the document you're reviewing to the provider you picked.

Since storage is per browser, a different browser or device starts empty. Export your documents to move them.

## Run it yourself

```bash
pnpm install
pnpm dev
```

It's a static site: `pnpm build` and host `dist/` anywhere.

## License

[MIT](LICENSE)
