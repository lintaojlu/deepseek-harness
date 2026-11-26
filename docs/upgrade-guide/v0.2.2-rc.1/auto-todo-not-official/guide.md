---
kind: upgrade-guide
description: "Auto todo leaves the official optional bundles, so the plugin manager no longer lists it as an experimental plugin."
---

# Install Auto todo as a profile plugin

English | [中文](guide.zh.md)

## Change

`@deepseek-ai/dsh-auto-todo-bundle` is no longer an installation optional bundle, and the package itself is gone. The `dsh` package no longer depends on it, and `OPTIONAL_BUNDLES` no longer names it. `@deepseek-ai/dsh-nil-plugin-bundle` now inserts Auto todo with the other local plugins. A profile that only selected the shipped copy, without its own dependency, no longer resolves Auto todo.

## Migration

1. In a profile that should keep Auto todo, install `@deepseek-ai/dsh-nil-plugin-bundle`: `dsh plugin --profile <name> add @deepseek-ai/dsh-nil-plugin-bundle`. A checkout can use `link:` to `packages/experimental/nil-plugin-bundle`.
2. Open Plugins and confirm Auto todo appears under installed plugins, not under experimental plugins.
