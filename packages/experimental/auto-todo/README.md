---
description: "Dated tasks board with tags, a focus timer, and stats kept in this browser."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-auto-todo

English | [中文](README.zh.md)

## Summary

Adds one Auto todo page to the sidebar. The page shows must-do and optional columns for one date, a tag bar, and a focus timer. Stats shows four readings, an activity count, and a completion heatmap. The whole board stays in this browser. A first launch with an empty board copies the schedule in `data/board.json`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Enable the [Nil plugin bundle](../nil-plugin-bundle/README.md). Open Auto todo from the sidebar. Add a task in either column. Click a row to edit it. The gear opens tags. Tasks and Stats switch in the page header.

### Minimal configuration

```yaml
- id: auto-todo
  name: '@deepseek-ai/dsh-client-ui-auto-todo'
```

The plugin needs `slots` and `locale`. It has no configuration fields.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The page registers under `main` and `sidebar.panellist` for the plugin lifetime. One `localStorage` document, `dsh.auto-todo.board`, holds tasks, groups, tags, and tasks moved off the board. When that document is missing, the page copies `data/board.json`. Title tidying, column classification, and title splitting use local rules. They do not call a model. A task is visible on a date when it is not skipped and either that date is an extra date or it falls in the start/due range and matches the recurrence.

| File | Responsibility |
| --- | --- |
| `src/client/index.ts` | Dictionaries, store, main panel, and sidebar entry |
| `src/client/AutoTodoPage.tsx` | Tasks, stats, dialogs, drag, and focus |
| `src/client/board-seed.ts` | First-run copy of `data/board.json` |
| `src/client/board-model.ts` | Board records and the edits the page commits |
| `src/client/board-stats.ts` | Rates, streaks, tag and idea readings, and the heatmap |
| `src/client/board-store.ts` | Persisted store and its actions |

</details>

-----

<a id="model-experience"></a>
## Model Experience

None. The page is local browser state and registers no tool, prompt, or session input.

#### KV Cache effect

None. This package adds nothing to a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- One browser keeps one board. It does not sync across devices.
- Column classification matches keywords. It does not ask a model.
- An open daily or weekday task is scanned a limited number of days ahead when deciding whether a clear deletes it.
- Tasks moved off the board stay in the saved document. The page has no inspiration list.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
