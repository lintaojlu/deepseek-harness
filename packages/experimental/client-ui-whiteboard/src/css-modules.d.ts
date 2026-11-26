/** CSS Modules compiled into the browser bundle. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

/** Compiled Excalidraw stylesheet text injected by the browser plugin. */
declare module '*.css?inline' {
  const css: string
  export default css
}
