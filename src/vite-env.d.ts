/// <reference types="vite/client" />

declare module '*.css' {
  const css: string
  export default css
}

declare module 'leaflet/dist/leaflet.css' {
  const css: string
  export default css
}
