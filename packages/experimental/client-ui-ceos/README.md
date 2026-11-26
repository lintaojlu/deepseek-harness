---
description: "CEOS name and tagline in the sidebar, and the CEOS mark on the new-session page and browser tab."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-ceos

English | [中文](README.zh.md)

## Summary

Replaces the sidebar name, the new-session mark, and the browser tab icon. The sidebar shows CEOS and the tagline 每个人都是自己的 CEO, without a mark or a version label. The wordmark uses a Fraunces subset at weight 800. This package is not an official plugin.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Enable the [Nil plugin bundle](../nil-plugin-bundle/README.md) from the profile. The sidebar then shows the CEOS name without a mark. The new-session page and the browser tab use the CEOS mark.

### Minimal configuration

```yaml
- id: ceos-ui
  name: '@deepseek-ai/dsh-client-ui-ceos'
```

The plugin needs `slots` and `locale`. It has no configuration fields.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin registers `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark` at priority -10, below the shipped brand at rank 0. The sidebar mark slot draws nothing, so the shipped logo stays hidden. One document icon link uses the new-session mark. Disposing the plugin removes the dictionaries, the link, and the three registrations.

| File | Responsibility |
| --- | --- |
| `src/client/index.ts` | Dictionaries, tab icon, and slot registration |
| `src/client/Brand.tsx` | Empty sidebar mark, mark image, and the two-line sidebar name |
| `src/client/brand.module.css` | Name layout and the Fraunces subset |

</details>

-----

<a id="model-experience"></a>
## Model Experience

None, as this plugin only replaces browser brand artwork and adds no model context.

#### KV Cache effect

None. This package adds nothing to a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Web only. The desktop Dock icon and the application icon stay unchanged.
- The sidebar has no mark and no version label.
- The tagline is the brand slogan in every language.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
