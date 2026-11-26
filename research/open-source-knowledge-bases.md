# 知识库与 RAG 项目核对笔记

核对日期：2026-11-12。范围为指定官方 GitHub 仓库当前分支的 README 与许可证，不固定到发行标签或 commit；后续采用某个版本时应重新核对该版本许可。

## 实际工具路径

本次使用的是 `functions.web_fetch`，没有调用 `web_search`。主代理实际通过 `functions.web_fetch` 请求 [GitHub Repository Search API](https://api.github.com/search/repositories?q=knowledge-base+in%3Aname%2Cdescription+stars%3A%3E1000&sort=stars&order=desc&per_page=8)，收到 HTTP 200、`total_count: 68`；这是 GitHub 仓库搜索接口，不是 DSH 的 DeepSeek Search API，也不是 Packy 的搜索服务。该调用和结果由主代理报告给核对代理。

核对代理随后使用 `functions.web_fetch` 直接请求下表中的官方仓库 README、LICENSE 原始 URL；这些来源均返回 HTTP 200。主代理另抓取 [Trilium GitHub 页面](https://github.com/TriliumNext/Trilium)，HTTP 200 但正文被导航占据且截断，随后改抓 [官方原始 README](https://raw.githubusercontent.com/TriliumNext/Trilium/main/README.md)，HTTP 200；下述 Trilium 信息依据主代理提供的抓取结果。主代理也复核了 BookStack README，确认其开发、Issues 和 PR 入口指向 Codeberg。该路径证明本次通过网页抓取工具访问了 GitHub 一手资料，不能据此声称观察到了 `web_search` 或其搜索 Provider 的网络请求。

## 用途与许可

| 项目 | 官方描述支持的用途 | 核实的许可证与限制 | 一手资料 |
| --- | --- | --- | --- |
| [BookStackApp/BookStack](https://github.com/BookStackApp/BookStack) | 存储、组织信息与文档的文档平台，强调直观编辑和简单使用体验；适合人工维护的知识库。 | MIT；保留版权和许可声明。第三方依赖各有许可。当前 README 的项目协作及许可链接指向 Codeberg，记录此变化，不将 GitHub 写成唯一当前托管地。 | [README](https://raw.githubusercontent.com/BookStackApp/BookStack/development/readme.md)、[LICENSE](https://raw.githubusercontent.com/BookStackApp/BookStack/development/LICENSE) |
| [outline/outline](https://github.com/outline/outline) | 面向团队的协作知识库，可使用官方托管服务或自行部署。 | Business Source License 1.1（BSL 1.1）。文本明确声明不是开源许可证；Additional Use Grant 禁止将其用于所定义的商业 Document Service（让员工、承包商以外的第三方创建和控制团队及文档）。当前许可标注 Outline 1.12.0，Change Date 为 2030-10-23，Change License 为 Apache 2.0；条款还规定按所述日期或该版本首次公开分发四周年中较早者转换，且各版本单独适用。不能把当前版本直接标为 Apache 2.0。 | [README](https://raw.githubusercontent.com/outline/outline/main/README.md)、[LICENSE](https://raw.githubusercontent.com/outline/outline/main/LICENSE) |
| [docmost/docmost](https://github.com/docmost/docmost) | 协作 wiki 与文档软件，提供实时协作、空间、权限、评论、页面历史、搜索及附件。 | 核心 AGPL 3.0；第 13 条针对修改后的网络服务版本要求向远程用户提供对应源码获取机会。README 指定 `apps/server/src/ee`、`apps/client/src/ee`、`packages/ee` 使用单独企业许可；企业代码生产使用要求满足企业条款且持有相应席位订阅。不能把整个仓库都视为 AGPL。 | [README](https://raw.githubusercontent.com/docmost/docmost/main/README.md)、[核心 LICENSE](https://raw.githubusercontent.com/docmost/docmost/main/LICENSE)、[企业 LICENSE](https://raw.githubusercontent.com/docmost/docmost/main/packages/ee/LICENSE) |
| [langgenius/dify](https://github.com/langgenius/dify) | LLM 应用开发平台，整合可视化工作流、RAG 管线、Agent、模型管理、可观测性及 API；知识库是应用构建流程的一部分。 | Dify Open Source License，基于 Apache 2.0 增加条件，不能简写成标准 Apache 2.0。许可允许商业使用，但未经书面授权不得运营多租户环境（一个 workspace 定义为一个 tenant）；使用前端时不得移除或修改控制台、应用中的 LOGO 或版权信息，相关情形需商业授权。无前端的使用不受该前端标识条款限制。 | [README](https://raw.githubusercontent.com/langgenius/dify/main/README.md)、[LICENSE](https://raw.githubusercontent.com/langgenius/dify/main/LICENSE) |
| [infiniflow/ragflow](https://github.com/infiniflow/ragflow) | 融合 RAG 与 Agent 的引擎，强调复杂文档解析、分块、检索、引用追溯与知识编译，适合基于资料构建问答系统。 | Apache License 2.0；分发时需遵守许可副本、修改标识及适用的版权和 NOTICE 保留要求，商标权不随许可授予。 | [README](https://raw.githubusercontent.com/infiniflow/ragflow/main/README.md)、[LICENSE](https://raw.githubusercontent.com/infiniflow/ragflow/main/LICENSE) |

## 个人知识库补充

[TriliumNext/Trilium](https://github.com/TriliumNext/Trilium) 面向大型个人知识库和层级笔记，提供自托管同步；官方 README 声明 GNU AGPL v3 或更新版本。它更接近个人知识管理工具，可与前述团队文档平台区分。来源：[官方 README](https://raw.githubusercontent.com/TriliumNext/Trilium/main/README.md)，由主代理实际抓取并报告；核对代理未另取其 LICENSE 全文。

## 选型区别

根据上述官方用途描述，BookStack、Outline、Docmost 更适合团队编写和维护文档；Dify 更适合搭建 LLM 应用与工作流；RAGFlow 更侧重文档处理和检索增强问答。这是用途分类，不是性能比较，也未执行部署验证。

如严格要求开放源码许可证，MIT 的 BookStack、AGPL 核心的 Docmost、Apache 2.0 的 RAGFlow 可按各自义务评估；Outline 当前 BSL 与 Dify 附加条件许可应单独列示，不应与标准 MIT / Apache 项目等同处理。

## 抓取补充记录

Docmost README 将企业许可路径写为 `packages/ee/License`，直接抓取 [该大小写路径](https://raw.githubusercontent.com/docmost/docmost/main/packages/ee/License) 返回 HTTP 404；改按 [实际大写 LICENSE 路径](https://raw.githubusercontent.com/docmost/docmost/main/packages/ee/LICENSE) 抓取成功，以上企业条款依据后者。
