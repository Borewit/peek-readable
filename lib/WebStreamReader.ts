import type { ReadableStream as NodeReadableStream, ReadableStreamBYOBReader } from 'node:stream/web';
import { EndOfStreamError } from './EndOfStreamError.js';
export { EndOfStreamError } from './EndOfStreamError.js';
import { AbstractStreamReader } from "./AbstractStreamReader.js";

export type AnyWebByteStream = NodeReadableStream<Uint8Array> | ReadableStream<Uint8Array>;

/**
 * Read from a WebStream
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
export class WebStreamReader extends AbstractStreamReader {

  private reader: ReadableStreamBYOBReader;

  public constructor(stream: AnyWebByteStream) {
    super();
    this.reader = stream.getReader({ mode: 'byob' }) as ReadableStreamBYOBReader;
  }

  protected async readFromStream(buffer: Uint8Array, offset: number, length: number): Promise<number> {

    if(this.endOfStream) {
      throw new EndOfStreamError();
    }

    const result = await this.reader.read(new Uint8Array(length));

    if (result.done) {
      this.endOfStream = result.done;
    }

    if(result.value) {
      buffer.set(result.value, offset);
      return result.value.byteLength;
    }

    return 0;
  }

  public abort(): Promise<void> {
    return this.reader.cancel();
  }
}
