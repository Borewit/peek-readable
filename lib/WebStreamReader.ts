// @ts-ignore
import { ReadableStreamBYOBReader, ReadableStream } from 'node:stream/web';
import { EndOfStreamError } from './EndOfFileStream.js';
export { EndOfStreamError } from './EndOfFileStream.js';

import type { IStreamReader } from "./index.js";

/**
 * Read from a WebStream
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
export class WebStreamReader implements IStreamReader {
  private reader: ReadableStreamBYOBReader;
  private peekQueue: Uint8Array[] = [];

  public constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader({ mode: 'byob' }) as ReadableStreamBYOBReader;
  }

  public async peek(buffer: Uint8Array, offset: number, length: number): Promise<number> {
    const bytesRead = await this.read(buffer, offset, length);
    this.peekQueue.push(buffer.subarray(offset, offset + bytesRead));
    return bytesRead;
  }

  public async read(buffer: Uint8Array, offset: number, length: number): Promise<number> {
    if (length === 0) {
      return 0;
    }

    if (this.peekQueue.length > 0) {
      let bytesRead = 0;
      while (this.peekQueue.length > 0 && bytesRead < length) {
        const peeked = this.peekQueue.shift()!;
        const toCopy = Math.min(peeked.length, length - bytesRead);
        buffer.set(peeked.subarray(0, toCopy), offset + bytesRead);
        bytesRead += toCopy;
        if (toCopy < peeked.length) {
          this.peekQueue.unshift(peeked.subarray(toCopy));
        }
      }
      return bytesRead;
    }

    const result = await this.reader.read(new Uint8Array(length));

    if (result.done) {
      throw new EndOfStreamError();
    }

    if(result.value) {
      buffer.set(result.value, offset);
      return result.value.byteLength;
    }

    return 0;
  }
}
