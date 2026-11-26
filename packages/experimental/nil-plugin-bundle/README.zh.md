---
description: "用于本地任务板、画板和 CEOS 标志的实验性 profile 组合包。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-nil-plugin-bundle

[English](README.md) | 中文

## 概述

启用这个 profile 组合包，加入本地任务板、画板和 CEOS 标志。它不是官方插件，因此不会出现在官方和实验性列表中。以后的本地插件也加到这个组合包。每个页面属于各自的插件。

## 目录

- [使用本包](#use-this-package)
- [实现原理](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在**插件 → 添加插件**中输入这个包目录的绝对路径，然后选择**安装**。这是实验性 profile 包，不在官方插件列表中。在**插件 → 已安装插件**中，这个组合包没有官方标记。在那里启用它。一个开关会打开这个组合包插入的全部插件。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

[`cordis.patch.yml`](cordis.patch.yml) 插入这些本地插件。以后的本地插件再加一条依赖和一条插入。组合包本身不提供服务。它不在官方可选组合包列表里，因此插件管理器报告 `official: false`。

</details>

-----

<a id="model-experience"></a>
## 模型体验

没有模型体验，因为这个组合包只挂载本地插件，不添加自己的模型上下文。

#### KV 缓存效果

没有。每个被插入的插件拥有自己发出的模型输入。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 一个开关会启用全部被插入的插件。
- 这个组合包不会出现在官方或实验性插件列表中。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
