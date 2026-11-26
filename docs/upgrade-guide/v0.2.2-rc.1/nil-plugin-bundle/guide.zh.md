---
kind: upgrade-guide
description: "原先分开的自动待办、画板和 CEOS 组合包改由一个本地插件组合包提供。"
---

# 从一个组合包安装本地插件

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-auto-todo-bundle`、`@deepseek-ai/dsh-whiteboard-bundle` 和 `@deepseek-ai/dsh-ceos-ui-bundle` 不再是包。依赖其中任一名称的 profile 无法解析它。`@deepseek-ai/dsh-nil-plugin-bundle` 插入同样的三个插件，并且不在官方插件列表中。

## 迁移

1. 把每条旧组合包依赖和 `dsh.profile.bundles` 里的对应条目换成 `@deepseek-ai/dsh-nil-plugin-bundle`。本地检出可以使用指向 `packages/experimental/nil-plugin-bundle` 的 `link:`。
2. 打开插件页，确认一张已安装卡片同时列出任务板、画板和 CEOS 标志。
