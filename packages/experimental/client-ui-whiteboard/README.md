---
description: "Sidebar Excalidraw canvas that saves on this computer or continues in a session."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-whiteboard

English | [中文](README.zh.md)

## Summary

Adds one Whiteboard page to the right sidebar. The page is a single Excalidraw canvas shared by every session on this browser. Light and dark follow a control on the page. Save downloads an Excalidraw file and keeps the same document in the browser. Send to session queues that session a PNG of the canvas plus the written prompt.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Enable the [Nil plugin bundle](../nil-plugin-bundle/README.md). Open Whiteboard from the tools in the right sidebar. Choose Light or Dark, then draw. Save downloads `whiteboard.excalidraw`. Open restores a file of that kind. Send to session asks for a session and a prompt, then queues both the image and the text.

### Minimal configuration

```yaml
- id: whiteboard
  name: '@deepseek-ai/dsh-client-ui-whiteboard'
```

The plugin needs `slots`, `locale`, `sessions`, and `sidebarRightTabs`. It has no configuration fields.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The page registers under `sidebar.right.pane.tab` for the plugin lifetime. One `localStorage` document, `dsh.whiteboard.scene`, holds the elements, files, and theme. Opening a file replaces that document. Sending calls `sessions.using` with source `whiteboardExport` and queues a user message whose parts are the PNG and the prompt.

| File | Responsibility |
| --- | --- |
| `src/client/index.ts` | Dictionaries, stylesheet, sidebar page, and slot registration |
| `src/client/Board.tsx` | Toolbar, theme, save, open, and the send dialog |
| `src/client/Canvas.tsx` | Excalidraw mount, change filter, and PNG export |
| `src/client/scene.ts` | Document parse, browser store, and download |
| `src/client/queue.ts` | Canonical PNG encoding and the queued prompt |

</details>

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the session prompt: sending a drawing queues an ordinary user message that contains the PNG and the written prompt.

#### KV Cache effect

The queued message is appended to that session's next request. The package adds no other request content.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- One browser keeps one scene. It does not sync, and a reload drops Excalidraw undo history.
- The session receives a PNG, not the Excalidraw document. A large image can be refused by attachment admission.
- Two visible Whiteboard tabs edit the same scene.
- Pasted images are not resized. The canvas still draws and exports a PNG.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
