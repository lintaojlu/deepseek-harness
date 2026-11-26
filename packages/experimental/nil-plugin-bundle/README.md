---
description: "Experimental profile bundle for the local task board, whiteboard, CEOS mark, and edit and resend."
kind: "package-bundle"
---

# @deepseek-ai/dsh-nil-plugin-bundle

English | [中文](README.zh.md)

## Summary

Enable this profile bundle to add the local task board, the whiteboard, the CEOS mark, and in-place edit and resend. It is not an official plugin, so it stays off the Official and Experimental lists. New local plugins are added to this same bundle. Each page belongs to its own plugin.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

In **Plugins → Add plugin**, enter the absolute path of this package directory and choose **Install**. The bundle is an experimental profile package and is absent from the official plugin lists. In **Plugins → Installed plugins**, it is listed without the official mark. Enable it there. One switch turns on every plugin this bundle inserts.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`cordis.patch.yml`](cordis.patch.yml) inserts the local plugins. Add a later local plugin as another dependency and another insert row. The bundle adds no service of its own. It is absent from the official optional-bundle lists, so the plugin manager reports `official: false`.

</details>

-----

<a id="model-experience"></a>
## Model Experience

None, as this bundle only mounts local plugins and adds no model context of its own.

#### KV Cache effect

None. Each inserted plugin owns any model input it sends.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- One switch enables every inserted plugin.
- The bundle does not appear in the Official or Experimental plugin lists.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
