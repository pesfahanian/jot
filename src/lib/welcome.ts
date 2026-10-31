import { createDocument, getDocument } from './documents'
import { getSettings, updateSettings } from './settings'

// The guide is a document (Phase 10): on a true first run Jot creates and
// opens "welcome to jot", a short tour that uses each feature it describes.
// It's the person's own document from then on — edit it, keep it, delete
// it. The guide card (sidebar foot "?") can bring it back.
//
// First run = no welcomedAt flag in settings and no documents. Existing
// workspaces (documents but no flag) just get the flag, and nothing else.

export const WELCOME_TITLE = 'welcome to jot'

export const WELCOME_CONTENT = String.raw`# welcome to jot

A quiet place to write markdown. This document is a short tour, and it's yours: edit it, keep it, or delete it. You can always get it back from the **?** at the bottom of the sidebar.

## writing

Everything is saved as you type. There's no save button, and Cmd/Ctrl + S does nothing on purpose.

- Lists continue when you press Enter.
  1. Numbered items count up by themselves.
  2. Enter on an empty item ends the list.
- [ ] Tasks work too.
- [x] Like this one.

Cmd/Ctrl + Shift + I tidies the whole document: bullets, emphasis and table columns. One undo reverses it.

The icon at the far right of the bar at the bottom shows or hides the minimap.

## seeing it rendered

Press Cmd/Ctrl + Shift + V to open the rendered view in a tab beside this one (or in a split: settings → editor). It scrolls along with the editor.

Math is written in LaTeX, inline like $a^2 + b^2 = c^2$ or on its own:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

Diagrams are written in Mermaid:

` + '```' + String.raw`mermaid
flowchart LR
  write --> render --> export
` + '```' + String.raw`

Code is coloured by its language:

` + '```' + String.raw`py
def greet(name):
    return f"hello, {name}"
` + '```' + String.raw`

| shortcut | does |
|---|---|
| Cmd/Ctrl + Shift + V | rendered view |
| Cmd/Ctrl + Shift + I | format the document |
| Cmd/Ctrl + F | find and replace |
| Cmd/Ctrl + K | the command palette: every command, and any document by name |
| Cmd/Ctrl + B | hide or show the sidebar |

## organising

- The sidebar holds your documents. **+** makes a new one; beside it are search, and one button to sort and filter by colour tag. The last icon (or Cmd/Ctrl + B) hides the sidebar, or brings it back.
- The gear at the bottom of the sidebar (Cmd/Ctrl + ,) opens settings: your AI provider, the theme, animations, keyboard shortcuts, import and your storage. Every shortcut can be changed there.
- **+** asks for a name first: type one and press Enter, or just click into the empty page to start writing. Esc, or clicking elsewhere, makes nothing. An unnamed document names itself after its first line as you write; rename it and the name stays.
- Right-click a document to tag it with a colour, rename, pin or delete it. Double-click it to rename.
- Drag tabs to reorder them, or onto another pane. Drop one on a pane's left or right edge for a new column, or on its top or bottom edge to stack two panes, up to three columns of two. Documents drag in from the sidebar too.
- Drag the gaps between panes to resize them. Double-click a gap to even it out.
- Drop .md files anywhere to import them, or pick files or a whole folder in settings → storage and backup, where the whole workspace exports as one .zip too. The export icon at the top right of a document saves it as Markdown, plain text or PDF (with page, font and colour options).
- The **+** at the end of the tabs makes a new document, as in a browser. So does double-clicking the empty space beside the tabs, or below the documents in the sidebar.

## marking it up

Select some text and right-click it for Jot's own menu:

- **highlight** it in one of three colours, or **underline** it. These are marks on the page, like a highlighter on a printout, not part of your markdown.
- **add note** pins a note of your own to the text. A dotted underline and a small square in the margin show where; click either to read or edit it. **notes** in the status bar lists them all.
- **translate** shows the selection in English or Farsi, through Google Translate with your own key (settings → translation). No AI is involved, and replacing your text is a separate click.

Highlights and notes show in the rendered view too. In a PDF they print if you ask (the PDF card's **annotations** row), with notes as footnotes. Markdown export can keep them as ==highlights== and footnotes.

Turn on **auto-fix spelling** in settings, and clear typos (teh, recieve, definately) get fixed a couple of words behind you as you write. It works in English only, never touches a real word, and Cmd/Ctrl + Z undoes a fix.

## comparing

To see what changed between two texts, right-click a document and choose **compare with…**, or right-click the tabs and choose **new comparison**. Each side can be a document or pasted text. Both sides stay editable, and the differences update as you type.

## writing in farsi

Farsi works as naturally as English. Each paragraph, list or table reads right-to-left or left-to-right by its own majority script, while code, links and formulas inside Farsi text keep reading left-to-right. When a document has Farsi in it, the **dir** cell in the bar at the bottom shows the direction, and can set the whole document right-to-left or left-to-right instead. For a diagram that flows right-to-left, write **flowchart RL**.

## ai mode

jot can work on a document with AI, using your own key. Your text goes straight from this browser to your provider; nothing passes through jot.

1. Open **settings** at the bottom of the sidebar, pick a provider (OpenRouter, Google AI Studio, OpenAI or Anthropic) and add your key. Below the key you can choose the model, and fallbacks to try if it's busy.
2. Press the sparkle at the bottom left (or Cmd/Ctrl + J). A chat opens where the sidebar was; Esc leaves, and your other panes come back as they were.
3. Ask a question, or ask for a change ("make the intro friendlier"). To point at a passage, select it, right-click and choose **add ai note**; notes go with your next message. Switch on **my notes as context** to send your own notes along too.
4. Changes come back as proposals. Open the results to accept, reject or rewrite each one, or switch to **diff** to see the whole result. Nothing changes until you press **apply**.

From the chat you can also run **review style**, which checks your prose against a style guide (English or Farsi). Very short documents, or ones that are all code, are skipped; **review anyway** overrides that. **translate document** writes a translation into a new document beside this one, section by section. The conversation is kept with its document, in this browser.

## where your writing lives

Everything stays in this browser. There's no account and no server, and your key only ever goes to the provider you chose.

That makes this browser the only copy. Each browser, profile and installed app keeps its own separate workspace, and clearing site data erases it. So now and then, export the whole workspace as a .zip: it's your backup, and dropping it on jot brings everything back, alongside whatever is already here. Safari deletes a site's data on its own after a week without use, so jot is better in Chrome, Firefox or Edge.
`

// Once per app load: guards React's double-run of effects in development.
let firstRun: Promise<void> | undefined

// Runs when the document list is first known. Creates the welcome document,
// pinned, on a true first run; marks an existing workspace as already welcomed.
export function welcomeIfFirstRun(documentCount: number): Promise<void> {
  firstRun ??= (async () => {
    const settings = await getSettings()
    if (settings.welcomedAt) return
    if (documentCount > 0) return void (await updateSettings({ welcomedAt: Date.now() }))
    // Pinned, so it stays at the top while the first documents arrive.
    const doc = await createDocument({ title: WELCOME_TITLE, content: WELCOME_CONTENT, pinned: true })
    await updateSettings({ welcomedAt: Date.now(), welcomeDocId: doc.id })
  })()
  return firstRun
}

// The guide card's "open the welcome document": the person's own copy if it
// still exists (edited or renamed, found by id), else a fresh one.
export async function welcomeDocumentId(): Promise<string> {
  const { welcomeDocId } = await getSettings()
  if (welcomeDocId && (await getDocument(welcomeDocId))) return welcomeDocId
  const doc = await createDocument({ title: WELCOME_TITLE, content: WELCOME_CONTENT })
  await updateSettings({ welcomeDocId: doc.id, welcomedAt: Date.now() })
  return doc.id
}
