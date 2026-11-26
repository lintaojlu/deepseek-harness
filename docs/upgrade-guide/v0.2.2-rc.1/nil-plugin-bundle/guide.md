---
kind: upgrade-guide
description: "The separate Auto todo, Whiteboard, and CEOS bundles are replaced by one local plugin bundle."
---

# Install local plugins from one bundle

English | [中文](guide.zh.md)

## Change

`@deepseek-ai/dsh-auto-todo-bundle`, `@deepseek-ai/dsh-whiteboard-bundle`, and `@deepseek-ai/dsh-ceos-ui-bundle` are no longer packages. A profile that depends on one of those names cannot resolve it. `@deepseek-ai/dsh-nil-plugin-bundle` inserts the same three plugins and stays off the official plugin lists.

## Migration

1. Replace each old bundle dependency and each `dsh.profile.bundles` entry with `@deepseek-ai/dsh-nil-plugin-bundle`. A checkout can use `link:` to `packages/experimental/nil-plugin-bundle`.
2. Open Plugins and confirm one installed card lists the task board, the whiteboard, and the CEOS mark.
