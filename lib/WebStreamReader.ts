import { AbstractStreamReader } from "./AbstractStreamReader.js";

export abstract class WebStreamReader extends AbstractStreamReader {

  public constructor(protected reader: ReadableStreamDefaultReader | ReadableStreamBYOBReader) {
    super();
  }

  protected abstract readFromStream(buffer: Uint8Array, offset: number, length: number): Promise<number>;

  public async abort(): Promise<void> {
    return this.close();
  }

  public async close(): Promise<void> {
    this.reader.releaseLock();
  }
}
