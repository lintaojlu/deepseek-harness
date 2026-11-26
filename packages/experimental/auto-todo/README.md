---
description: "Daily task board with a right-sidebar checklist, activity statistics, and model-assisted classification."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-auto-todo

English | [中文](README.zh.md)

## Summary

Daily tasks opens the board from the left sidebar and today's must-do checklist from the right sidebar guide. The board keeps must-do and optional tasks by date, with tags, a focus timer, and activity statistics. The browser keeps the board and initializes it from `data/board.json` on first use.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Enable the [Nil plugin bundle](../nil-plugin-bundle/README.md) and open Daily tasks. Click a row to edit a task or choose Classify from its context menu to add matching tags. Open Settings to manage tags or choose a classification model. Double-click a tag on the board to edit it directly.

In Sync, scroll to find the source date. Cancel and Sync stay visible below the list.

In the right-sidebar checklist, press Enter in the add field to create a must-do task for today. Added tasks, tag colors, and completion updates appear in both views.

### Minimal configuration

```yaml
- id: auto-todo
  name: '@deepseek-ai/dsh-client-ui-auto-todo'
```

The Web profile supplies the Host model router, credentials service and Client sidebar seats. The plugin has no YAML settings. Its Model settings follow the DSH default by default. Select JEV, enter an API key and save to switch. The same form can fetch available JEV model names, and a blank model uses `jev-latest`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The board and the right-sidebar tab share `dsh.auto-todo.board` in browser storage. A task is visible on dates included by its recurrence, start and due dates, or explicit extra dates, excluding skipped dates. The Host stores model settings in the credentials service and returns only key presence to the Client. Classification adds existing tags and preserves the task's assigned tags and column. A failed request leaves the task unchanged.

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Model routes, model discovery and credentials |
| `src/client/mount.ts` | Shared board, dictionaries, and sidebar registrations |
| `src/client/AutoTodoPage.tsx` | Tasks, stats, dialogs, drag, and focus |
| `src/client/board-seed.ts` | First-run copy of `data/board.json` |
| `src/client/board-model.ts` | Board records and the edits the page commits |
| `src/client/board-stats.ts` | Rates, streaks, tag and idea readings, and the heatmap |
| `src/client/board-store.ts` | Persisted store and its actions |

</details>

-----

<a id="model-experience"></a>
## Model Experience

### Classification and tag descriptions

#### What the model sees

Classify sends the task title, notes, and the names and descriptions of assigned and candidate tags. DSH returns a JSON array of matching candidate indexes, such as `[0, 2]`. JEV answers one matching question per candidate in a single request using `match` and `skip`. Generate description uses the DSH default model with the tag's name, description, and tagged task titles. Both operations run independently of conversations.

#### Token effect

Each explicit classification or generated description makes one model request. Task creation, edits, sync, and statistics make none.

#### KV Cache effect

Requests use task or tag text with a fixed instruction and leave conversation context unchanged.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- One browser keeps one board. It does not sync across devices.
- An open daily or weekday task is scanned a limited number of days ahead when deciding whether a clear deletes it.
- Tasks moved off the board stay in the saved document. The page has no inspiration list.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
