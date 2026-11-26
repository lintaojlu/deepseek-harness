---
description: "侧栏中的 CEOS 名称和口号，以及新会话页和浏览器标签页上的 CEOS 标志。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-ceos

[English](README.md) | 中文

## 概述

替换侧栏名称、新会话页标志和浏览器标签页图标。侧栏显示 CEOS 和口号「每个人都是自己的 CEO」，不显示标志，也不显示版本号。字标使用 800 字重的 Fraunces 子集。本包不是官方插件。

## 目录

- [使用本包](#use-this-package)
- [实现原理](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 profile 中启用 [Nil 插件组合包](../nil-plugin-bundle/README.zh.md)。侧栏随后显示 CEOS 名称，不显示标志。新会话页和浏览器标签页使用 CEOS 标志。

### 最小配置

```yaml
- id: ceos-ui
  name: '@deepseek-ai/dsh-client-ui-ceos'
```

插件需要 `slots` 和 `locale`。它没有配置字段。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

插件以优先级 -10 注册 `sidebar.brand.mark`、`sidebar.brand.name` 和 `conversation.hero.brand.mark`，低于排名 0 的随附品牌。侧栏标志插槽不绘制内容，因此随附标志保持隐藏。文档图标链接使用新会话页的标志。卸载插件会移除词典、链接和这三项注册。

| 文件 | 职责 |
| --- | --- |
| `src/client/index.ts` | 词典、标签页图标和插槽注册 |
| `src/client/Brand.tsx` | 空白的侧栏标志、标志图片和侧栏两行名称 |
| `src/client/brand.module.css` | 名称排版和 Fraunces 子集 |

</details>

-----

<a id="model-experience"></a>
## 模型体验

没有模型体验，因为这个插件只替换浏览器里的品牌图样，不添加模型上下文。

#### KV Cache 影响

没有。本包不向模型请求添加任何内容。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 仅限 Web。桌面 Dock 图标和应用程序图标保持不变。
- 侧栏没有标志，也没有版本号。
- 每种语言的口号都是这句品牌标语。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
