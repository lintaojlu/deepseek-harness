import { defineConfig } from 'tsdown'

/** Builds the published entry as a self-contained ESM file admitted by the package whitelist. */
export default defineConfig([
  {
    entry: ['lib/types/index.js'], outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024',
    fixedExtension: false, outputOptions: { codeSplitting: false }, dts: false, clean: false,
    deps: { alwaysBundle: ['zod'] },
  },
])
