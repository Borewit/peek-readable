import { EndOfStreamError } from './Errors.js';
import { AbstractStreamReader } from "./AbstractStreamReader.js";

export class WebStreamDefaultReader extends AbstractStreamReader {
  private buffer: Uint8Array | null = null; // Internal buffer to store excess data
  private bufferOffset = 0; // Current position in the buffer

  public constructor(private reader: ReadableStreamDefaultReader<Uint8Array>) {
    super();
  }

  /**
   * Read from stream
   * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
   * @param mayBeLess - If true, may fill the buffer partially
   * @protected Bytes read
   */
  protected async readFromStream(buffer: Uint8Array, mayBeLess: boolean): Promise<number> {

    if (buffer.length === 0) return 0;

    let totalBytesRead = 0;
    let remaining = buffer.length;

    // Serve from the internal buffer first
    if (this.buffer) {
      const remainingInBuffer = this.buffer.byteLength - this.bufferOffset;
      const toCopy = Math.min(remainingInBuffer, remaining);
      buffer.set(this.buffer.subarray(this.bufferOffset, this.bufferOffset + toCopy));
      this.bufferOffset += toCopy;
      totalBytesRead += toCopy;
      remaining -= toCopy;

      // If the buffer is exhausted, clear it
      if (this.bufferOffset >= this.buffer.byteLength) {
        this.buffer = null;
        this.bufferOffset = 0;
      }
    }

    // Continue reading from the stream if more data is needed
    while (remaining > 0 && !this.endOfStream) {
      const result = await this.reader.read();

      if (result.done) {
        this.endOfStream = true;
        break;
      }

      if (result.value) {
        const chunk = result.value;

        // If the chunk is larger than the requested length, store the excess
        if (chunk.byteLength > remaining) {
          buffer.set(chunk.subarray(0, remaining), totalBytesRead);
          this.buffer = chunk;
          this.bufferOffset = remaining; // Keep track of the unconsumed part
          totalBytesRead += remaining;
          return totalBytesRead;
        }

        // Otherwise, consume the entire chunk
        buffer.set(chunk);
        totalBytesRead += chunk.byteLength;
        remaining -= chunk.byteLength;
      }
    }

    if (totalBytesRead === 0 && this.endOfStream) {
      throw new EndOfStreamError();
    }

    return totalBytesRead;
  }

  public abort(): Promise<void> {
    this.interrupted = true;
    return this.reader.cancel();
  }

  public async close(): Promise<void> {
    await this.abort();
    this.reader.releaseLock();
  }
}
