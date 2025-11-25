// Minimal type declarations to satisfy TypeScript for stream-json modules
// These modules do not ship official typings; treat exports as any.

declare module 'stream-json' {
  export function parser(options?: any): any;
}

declare module 'stream-json/filters/Pick' {
  export function pick(options?: any): any;
}

declare module 'stream-json/streamers/StreamArray' {
  export function streamArray(options?: any): any;
}
