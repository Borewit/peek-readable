
import { WebStreamReader } from './WebStreamReader.js';

/**
 * Read from a WebStream using a BYOB reader
 * Reference: https://nodejs.org/api/webstreams.html#class-readablestreambyobreader
 */
export class WebStreamByobReader extends WebStreamReader {

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
}
