---
description: "侧边栏中的 Excalidraw 画布，可保存在这台电脑上，或在某个会话中继续。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-whiteboard

[English](README.md) | 中文

## 概述

在右侧边栏增加一个画板页。这个浏览器里的所有会话共用一张 Excalidraw 画布。页面上的控件切换浅色和深色。保存会下载 Excalidraw 文件，并在浏览器里保留同一份文档。发送到会话会把画布的 PNG 和写好的提示排进该会话。

## 目录

- [使用本包](#use-this-package)
- [实现原理](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

启用 [Nil 插件组合包](../nil-plugin-bundle/README.zh.md)。从右侧边栏的工具中打开画板。选择浅色或深色，然后绘图。保存会下载 `whiteboard.excalidraw`。打开会恢复这种文件。发送到会话会询问会话和提示，然后把图像和文本一起排队。

### 最小配置

```yaml
- id: whiteboard
  name: '@deepseek-ai/dsh-client-ui-whiteboard'
```

插件需要 `slots`、`locale`、`sessions` 和 `sidebarRightTabs`。它没有配置字段。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

页面在插件存活期间注册到 `sidebar.right.pane.tab`。一份 `localStorage` 文档 `dsh.whiteboard.scene` 保存元素、文件和主题。打开文件会替换这份文档。发送时以来源 `whiteboardExport` 调用 `sessions.using`，并排队一条由 PNG 和提示组成的用户消息。

| 源码 | 内容 |
| --- | --- |
| `src/client/index.ts` | 词典、样式表、侧边栏页面和插槽注册 |
| `src/client/Board.tsx` | 工具栏、主题、保存、打开和发送对话框 |
| `src/client/Canvas.tsx` | Excalidraw 挂载、变更过滤和 PNG 导出 |
| `src/client/scene.ts` | 文档解析、浏览器存储和下载 |
| `src/client/queue.ts` | PNG 的规范编码和排队提示 |

</details>

-----

<a id="model-experience"></a>
## 模型体验

间接影响来自会话提示：发送画板会排队一条普通用户消息，其中包含 PNG 和写下的提示。

#### KV Cache 影响

这条排队消息会附加到该会话的下一次请求。本包不添加其他请求内容。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 一个浏览器只保留一张画布。它不会同步，重新加载后 Excalidraw 的撤销历史也会丢掉。
- 会话收到的是 PNG，不是 Excalidraw 文档。过大的图像可能被附件准入拒绝。
- 两个同时可见的画板页会编辑同一张画布。
- 粘贴的图像不会被缩放。画布仍然可以绘图并导出 PNG。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
