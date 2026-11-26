import { clientBundle } from '../../client/tsdown.client.ts'

const bundle = clientBundle(import.meta.dirname, ['lib/types/index.js'])

/** Excalidraw loads image resizers with dynamic imports the client compiler cannot emit. Drawing and PNG export do not need them. */
const stubImageResize = {
  name: 'whiteboard-stub-image-resize',
  transform(code: string, id: string) {
    if (!id.includes('@excalidraw/excalidraw') || !code.includes('import("pica")')) return null
    return code
      .replaceAll('import("pica")', 'Promise.resolve({ default() { return { toBlob: async () => new Blob() } } })')
      .replaceAll('import("image-blob-reduce")', 'Promise.resolve({ default(options) { return { ...options } } })')
  },
}

export default function config(inline: { env?: Record<string, unknown> }) {
  return bundle(inline).map(entry => ({
    ...entry,
    // The client loader only executes client.js. A static require() of a split
    // chunk never resolves, so the plugin factory throws before it can register.
    outputOptions: {
      ...entry.outputOptions,
      codeSplitting: false,
      inlineDynamicImports: true,
    },
    plugins: [stubImageResize, ...(entry.plugins ?? [])],
  }))
}
