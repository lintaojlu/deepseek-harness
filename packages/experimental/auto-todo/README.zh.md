---
description: "每日任务板，提供右侧栏必做清单、活跃统计和模型分类。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-auto-todo

[English](README.md) | 中文

## 概述

左侧栏的「每日任务」打开任务板，右侧栏的引导页可打开今日必做清单。任务板按日期管理必做和选做任务，提供标签、专注计时和活跃统计。浏览器保存任务板，初次使用时从 `data/board.json` 初始化。

## 目录

- [使用本包](#use-this-package)
- [实现原理](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

启用 [Nil 插件组合包](../nil-plugin-bundle/README.zh.md) 并打开「每日任务」。单击任务行可编辑，右键选择「分类」可添加匹配的标签。在「设置」中管理标签或选择分类模型，也可在任务板上双击标签直接编辑。

打开「同步」后，可滚动查找来源日期。「取消」和「同步」按钮始终显示在列表下方。

在右侧栏清单的输入框中按回车，可添加今日必做任务。新增任务、标签颜色和完成状态会同步显示在两个界面上。

### 最小配置

```yaml
- id: auto-todo
  name: '@deepseek-ai/dsh-client-ui-auto-todo'
```

Web 配置提供宿主模型路由、凭证服务和客户端侧栏插槽。插件没有 YAML 设置。分类默认跟随 DSH 默认模型。选择 JEV、输入 API Key 并保存即可切换。表单可获取 JEV 模型列表，模型留空时使用 `jev-latest`。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

任务板和右侧栏共用浏览器存储中的 `dsh.auto-todo.board`。任务显示在开始与截止日期和重复规则覆盖的日期，以及显式加入的日期，已跳过的日期除外。宿主将模型设置保存在凭证服务里，客户端只收到密钥保存状态。分类从标签库添加标签，并保留任务已有的标签和所属列。请求失败时任务保持原样。

| 源码 | 内容 |
| --- | --- |
| `src/index.ts` | 模型路由、模型列表和凭证 |
| `src/client/mount.ts` | 共享任务板、字典和侧栏注册 |
| `src/client/AutoTodoPage.tsx` | 任务、统计、对话框、拖拽和专注 |
| `src/client/board-seed.ts` | 首次打开时抄入 `data/board.json` |
| `src/client/board-model.ts` | 任务板记录和页面提交的编辑 |
| `src/client/board-stats.ts` | 完成率、连续天数、标签和灵感读数、热力图 |
| `src/client/board-store.ts` | 持久化存储及其操作 |

</details>

-----

<a id="model-experience"></a>
## 模型体验

### 分类和标签描述

#### 模型看到的内容

分类发送任务标题、说明，以及已选标签和候选标签的名称与描述。DSH 返回匹配的候选标签索引数组，例如 `[0, 2]`。JEV 在一次请求中分别用 `match` 和 `skip` 表示每个候选标签是否匹配。生成标签描述时，DSH 默认模型收到标签名称、已有描述和关联任务的标题。两项操作独立于会话运行。

#### Token 影响

每次主动分类或生成描述发起一次模型请求。创建、编辑、同步和统计任务不发起请求。

#### KV Cache 影响

请求使用任务或标签文本和固定指令，不改变会话上下文。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 一个浏览器只保留一块任务板。它不会在设备之间同步。
- 清空一天时，开放的每日或工作日任务只向前扫描有限天数，用来决定要不要删掉整条记录。
- 从任务板上移走的任务仍留在保存的文档里。页面没有灵感列表。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
