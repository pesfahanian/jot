# Jot: design the next round — the app's shape, Settings, command palette, motion, annotations and AI mode

## Context
Jot is a minimal, desktop-only markdown editor that runs entirely in the browser (jot.software). No backend: documents live in the browser's storage, and AI calls go straight from the browser to the person's own provider (OpenRouter, Google AI Studio, OpenAI or Anthropic) with their own key. A handful of people use it daily now, and this round comes from what they ran into.

Its visual language is fixed and attached:
- **Jot Design System v3:** tokens, type, components.
- **Jot Shell v3:** the floating-panel shell.
- **The last round's accepted frames** (diff checker, Farsi, PDF options), so new frames stay consistent with them.
- **Current screenshots** of the app: the shell with two panes, the style review open, a diff tab, and the PDF options card. The shell has moved on from Shell v3; the screenshots are the truth.

Today's shell, for orientation:
- **Sidebar (left):**
  - header: the wordmark, then icons for new document, new comparison, sort, colour filter, search
  - the document list
  - foot: "AI Provider" (opens the provider and key panel), "?" (the guide), and the theme icon
- **Panes (right):** up to 3 columns × 2 rows. Each pane has:
  - a tab strip ending in a **+**; tabs can be documents, rendered views, diff tabs or a review
  - controls on the right: split, render, export ▾, and "⋯"
- **Status bar (bottom):**
  - left: the style review control
  - right: dir (only for Farsi documents), cursor, counts, minimap toggle

This round is about **the app's shape**: where everything lives, now that a lot more is arriving. It isn't nine separate features. Please design them as one coherent system.

## Rules
- **Only Jot's existing tokens, type and components.** Call out anything new you need: tokens, a weight, a component.
- **Light and dark:** identical shapes, spacing and radii; only colour differs. Show both for the key frames.
- **Text case:** UI labels lowercase ("continue to print", "find difference"); full sentences in sentence case.
- **Desktop only (≥ 1000 px window),** but panes can be as narrow as 260 px.
- **No formatting toolbar, anywhere.** A bar of bold / italic / heading buttons is the one thing Jot will never have. The right-click menu below is not a toolbar: it appears only on request, on selected text.
- **The interface stays English.** Documents can be Farsi (right-to-left) or mixed; anything that shows document text must cope with right-to-left (see the Farsi frames).
- **No "unsaved" state.** Every edit saves continuously.
- **Nothing the AI does applies itself.** Every AI change is a proposal the person accepts, rejects or edits.

## 1. The shell: where everything lives
Re-place the controls for everything below. Specifically:
- **Collapse the sidebar.** A button (and Cmd+B) hides the sidebar entirely and brings it back. Show both states, and where the button sits in each.
- **Where the AI lives:** the entry to **AI mode** (section 5) replaces today's status-bar review control and the sidebar's "AI Provider" item.
- **Where settings live:** the entry to **Settings** (section 2).
- **Import:** a new "import…" action (pick several files, or a whole folder). Propose where it lives; export → workspace is its counterpart today.
- **New comparison, sort, filter, search:** keep or move. With a command palette (section 3), some controls may not need a visible button at all. Say which you'd drop, and why.
- **Double-click on empty space** in the tab strip, or below the sidebar's rows, makes a new document. No visual needed unless you want a hint.

Deliver the whole shell in its new arrangement, light and dark: normal mode, sidebar collapsed, and AI mode.

## 2. Settings
A **modal**, opened from the shell and from the command palette. Sections, as decided (propose order, grouping and layout):
- **AI provider:** today's AI Provider panel moves in here unchanged in content: provider dropdown, key with test and clear, model chain picker.
- **Translation:** a separate Google Cloud Translation key, for translating a selection (section 4).
- **Appearance:** theme (light / dark / system), animations on/off. Animations are always off when the system asks for reduced motion.
- **Editor:**
  - minimap
  - auto-fix spelling: off by default; when on, it quietly corrects clear typos a couple of words behind the cursor, and each fix flashes briefly
- **Keyboard shortcuts:** the shortcut editor (section 3).
- **Storage and backup:**
  - this browser's storage state (persistent or not)
  - export the workspace
  - import
  - a line explaining that each browser keeps its own separate workspace
- **About:** version, licence, the guide, source link.

Frames: the modal on its first section, a scrolled or other section, the shortcut editor section, light and dark.

## 3. Command palette and shortcut editor
- **Command palette:** Cmd+K or Cmd+Shift+P (propose which; Jot uses VS Code's keymap). A filter-first list of every action:
  - new document, new comparison, import, export…
  - open a document by name (a quick switch)
  - toggles: sidebar, minimap, theme
  - Settings
  - AI mode's actions: review style, translate document, send notes

  Each row shows its shortcut if it has one. Show it empty (recent and suggested), filtered, and switching to a document.
- **Shortcut editor** (inside Settings):
  - every command with its key, searchable
  - click a key to re-record it
  - a clash with an existing binding or a browser shortcut shows inline before saving, with "replace" or "cancel"
  - reset one, or reset all

## 4. Annotations: highlights, underline, notes (no AI)
- **Right-click on selected text** opens Jot's own menu, replacing the browser's there:
  - cut, copy, paste
  - highlight
  - underline
  - add note
  - translate
  - add AI note (only in AI mode, see 5)

  Show it on English and on Farsi text.
- **Highlights and underline** are marks over the text, like a highlighter on a printout, not markdown formatting. Propose a few highlight colours, or one. Show how they read in the editor, light and dark, including over a Farsi line.
- **Notes (personal):** a note pinned to a stretch of text. Show:
  - the marked text
  - how a note is opened and read, in the margin or a popover (propose)
  - editing and deleting a note
  - many notes in one document
- **Translate a selection:** machine translation of the selected text, no AI. The result appears in a small popover: original and translation, copy, and "replace selection" (an explicit choice). Show English → Farsi and Farsi → English. If there's no key, it points to Settings.
- **Exports:**
  - **PDF:** the PDF options card gains a row "annotations: off / highlights / highlights + comments". In the PDF, comments become page footnotes, numbered at the marked text.
  - **Markdown:** export offers "clean" (the default) or "with annotations". Highlights become `==text==` and notes become footnotes.

  Design the new card row and the export choice. Show one PDF page with a highlight and two footnoted comments.

## 5. AI mode
The biggest part. Today the AI is one button, the style review. It becomes **AI mode**: a distinct state of the screen for working on **one document** with AI. It's modelled on **Claude Design**, so its comment queue and chat are the reference. Everything decided:
- **Entering:**
  - from the shell's AI entry (section 1) or the palette
  - with a small, quick transition animation into the mode (see section 6)
  - leaving returns to normal mode
- **The layout:**
  - a **chat area on the left**, like Claude Design's
  - the document in the middle, still editable
  - results as below

  Propose what happens to the sidebar, the other panes and the status bar while in AI mode.
- **AI notes:**
  - instructions pinned to text ("make this shorter", "more formal", "change it like this"), added from the right-click menu
  - they must look clearly different from personal notes (section 4), at a glance
  - they **queue up**, shown above the chat's message box like Claude Design's pending comments, and go out together with the next message; sending one right away is just a batch of one
  - a per-send switch also includes the person's **personal notes** as context
- **Chat:**
  - **acts unless told not to**, like Claude Design: asking for a change produces proposals; a question, or "don't change anything", gets an answer only
  - history is kept per document, locally
  - show a conversation with an answer, a request that produced proposals, and the notes queue
- **The style review** is one of AI mode's actions (a button or chip near the chat, and a palette command), no longer a status-bar control. Its results look as they do today: kinds (Quick fix teal / Check fix amber / Your call violet), bubbles, decide each.
- **One results screen for every run** (style review, notes, chat requests):
  - **review view (deciding):** the document with each proposed change marked; accept, reject or edit each, as in today's style review
  - **diff view (looking):** one switch turns the same proposals into a clean diff of original vs result, using the diff checker's look. A second switch, which must be obvious, picks "as decided" (only accepted changes) or "if all accepted"

  Show both views and the switch between them.
- **Full translation:**
  - started from the chat or a button
  - the AI translates the whole document into a **new document** ("title (فارسی)") that opens side by side with the original
  - no per-change decisions: it's a fresh draft
  - show the request, the progress (long documents go section by section, which can take a while), and the result
- **Right-to-left:** a Farsi document in AI mode, with the review view, the chat quoting Farsi text, and AI notes on Farsi lines.
- **Errors:** no key set, the provider failing, the model declining.

## 6. Motion
A short motion spec for the whole app: durations, easing, and where motion is used. Restrained; Jot is a calm tool. Candidates:
- entering and leaving AI mode (the signature one)
- opening the diff checker and a review
- a new pane or tab appearing
- popovers and menus
- the auto-fix flash
- the palette opening

Say what never animates. Everything respects reduced motion and the Settings switch. Static frames with annotations of the motion are enough.

## Frames to deliver
1. Shell, normal mode, new arrangement (light + dark)
2. Shell, sidebar collapsed
3. Settings modal: two sections, plus the shortcut editor (light + dark)
4. Command palette: empty, filtered, switching documents
5. Right-click menu on selected text: English, Farsi, and in AI mode
6. Highlights and underline in the editor (light + dark, with a Farsi line)
7. A personal note: marked text, open, editing; a document with several
8. Translate-a-selection popover: both directions, and no key
9. PDF options card with the annotations row; the markdown export choice; a PDF page with highlights and footnoted comments
10. Entering AI mode: the transition, as a short storyboard
11. AI mode: chat, document, queued AI notes vs personal notes (light + dark)
12. AI mode: results, review view
13. AI mode: results, diff view, with the "as decided / if all accepted" switch
14. AI mode: the style review as an action, and its results
15. AI mode: full translation (request, progress, the new document side by side)
16. AI mode with a Farsi document
17. AI mode errors: no key, provider failing, model declining
18. The motion spec

## Deliverable
A canvas with the frames above, labelled. Add a short note on every decision this brief didn't settle:
- where each control went, and anything dropped in favour of the palette
- the palette shortcut
- highlight colours
- how notes are read
- what AI mode does to the sidebar, panes and status bar
- how AI notes and personal notes differ
- the results switch
- the motion spec's choices

Also note anything you'd push back on.
