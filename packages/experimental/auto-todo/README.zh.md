---
description: "按日期排列的任务板，带标签、专注计时和统计，保存在这台浏览器里。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-auto-todo

[English](README.md) | 中文

## 概述

在侧边栏增加一个自动待办页。页面按一天展示必做和选做两列、标签条和专注计时。统计页有四项读数、活动计数和完成热力图。整块任务板留在这台浏览器里。浏览器里还没有任务板时，页面会抄入 `data/board.json`。

## 目录

- [使用本包](#use-this-package)
- [实现原理](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

启用 [Nil 插件组合包](../nil-plugin-bundle/README.zh.md)。从侧边栏打开自动待办。在任一列添加任务。点一行即可编辑。齿轮打开标签。任务和统计在页面顶栏切换。

### 最小配置

```yaml
- id: auto-todo
  name: '@deepseek-ai/dsh-client-ui-auto-todo'
```

插件需要 `slots` 和 `locale`。它没有配置字段。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

页面在插件存活期间注册到 `main` 和 `sidebar.panellist`。一份 `localStorage` 文档 `dsh.auto-todo.board` 保存任务、分组、标签，以及从任务板上移走的任务。这份文档还不存在时，页面抄入 `data/board.json`。整理标题、判断栏目和拆分标题都用本地规则，不调用模型。任务在某一天可见的条件是：那天没有被跳过，并且要么是额外日期，要么落在开始和截止范围内并符合重复规则。

| 源码 | 内容 |
| --- | --- |
| `src/client/index.ts` | 词典、存储、主面板和侧边栏入口 |
| `src/client/AutoTodoPage.tsx` | 任务、统计、对话框、拖拽和专注 |
| `src/client/board-seed.ts` | 首次打开时抄入 `data/board.json` |
| `src/client/board-model.ts` | 任务板记录和页面提交的编辑 |
| `src/client/board-stats.ts` | 完成率、连续天数、标签和灵感读数、热力图 |
| `src/client/board-store.ts` | 持久化存储及其操作 |

</details>

-----

<a id="model-experience"></a>
## 模型体验

没有模型体验。页面是浏览器本地状态，不注册工具、提示或会话输入。

#### KV Cache 影响

没有。本包不向模型请求添加任何内容。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 一个浏览器只保留一块任务板。它不会在设备之间同步。
- 栏目判断匹配关键词，不会询问模型。
- 清空一天时，开放的每日或工作日任务只向前扫描有限天数，用来决定要不要删掉整条记录。
- 从任务板上移走的任务仍留在保存的文档里。页面没有灵感列表。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
