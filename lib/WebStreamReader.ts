import { ReadableStreamBYOBReader, ReadableStream } from 'node:stream/web';
import { EndOfStreamError } from './EndOfStreamError.js';
export { EndOfStreamError } from './EndOfStreamError.js';
import { AbstractStreamReader } from "./AbstractStreamReader.js";

/**
 * Read from a WebStream
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
export class WebStreamReader extends AbstractStreamReader {
  private reader: ReadableStreamBYOBReader;
  private eofStream = false;

  public constructor(stream: ReadableStream<Uint8Array>) {
    super();
    this.reader = stream.getReader({ mode: 'byob' }) as ReadableStreamBYOBReader;
  }

  protected async readFromStream(buffer: Uint8Array, offset: number, length: number): Promise<number> {

    if(this.eofStream) {
      throw new EndOfStreamError();
    }

    const result = await this.reader.read(new Uint8Array(length));

    if (result.done) {
      this.eofStream = result.done;
    }

    if(result.value) {
      buffer.set(result.value, offset);
      return result.value.byteLength;
    }

    return 0;
  }
}
