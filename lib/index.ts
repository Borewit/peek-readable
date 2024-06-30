export interface IStreamReader {
  peek(uint8Array: Uint8Array, offset: number, length: number): Promise<number>;
  read(buffer: Uint8Array, offset: number, length: number): Promise<number>
}
export { EndOfStreamError } from './EndOfFileStream.js';
export { StreamReader } from './StreamReader.js';
export { WebStreamReader } from './WebStreamReader.js';