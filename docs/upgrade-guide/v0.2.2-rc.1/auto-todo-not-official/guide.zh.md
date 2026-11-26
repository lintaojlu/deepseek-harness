---
kind: upgrade-guide
description: "自动待办不再属于官方可选组合包，插件管理器不再把它列为实验性插件。"
---

# 把自动待办作为 profile 插件安装

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-auto-todo-bundle` 不再是安装附带的可选组合包，这个包本身也已删除。`dsh` 包不再依赖它，`OPTIONAL_BUNDLES` 也不再列出它。`@deepseek-ai/dsh-nil-plugin-bundle` 现在把自动待办和其他本地插件一起插入。只选中过随安装提供的副本、自己没有依赖的 profile，将无法再解析自动待办。

## 迁移

1. 在需要保留自动待办的 profile 中安装 `@deepseek-ai/dsh-nil-plugin-bundle`：`dsh plugin --profile <name> add @deepseek-ai/dsh-nil-plugin-bundle`。本地检出可以使用指向 `packages/experimental/nil-plugin-bundle` 的 `link:`。
2. 打开插件页，确认自动待办出现在已安装插件中，而不是实验性插件中。
