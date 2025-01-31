import type { ReadableStreamBYOBReader } from 'node:stream/web';
import { AbstractStreamReader } from "./AbstractStreamReader.js";

/**
 * Read from a WebStream using a BYOB reader
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
export class WebStreamByobReader extends AbstractStreamReader {

  public constructor(private reader: ReadableStreamBYOBReader) {
    super();
  }

  protected async readFromStream(buffer: Uint8Array, offset: number, length: number): Promise<number> {

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
    return this.reader.cancel(); // Signals a loss of interest in the stream by a consumer
  }

  public async close(): Promise<void> {
    await this.abort();
    this.reader.releaseLock();
  }
}
