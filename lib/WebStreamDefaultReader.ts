import type { ReadableStreamDefaultReader } from 'node:stream/web';
import { EndOfStreamError } from './EndOfStreamError.js';
import { AbstractStreamReader } from "./AbstractStreamReader.js";

export class WebStreamDefaultReader extends AbstractStreamReader {
  private buffer: Uint8Array | null = null; // Internal buffer to store excess data
  private bufferOffset = 0; // Current position in the buffer

  public constructor(private reader: ReadableStreamDefaultReader) {
    super();
  }

  protected async readFromStream(buffer: Uint8Array, offset: number, length: number): Promise<number> {
    if (this.endOfStream) {
      throw new EndOfStreamError();
    }

    let totalBytesRead = 0;

    // Serve from the internal buffer first
    if (this.buffer) {
      const remainingInBuffer = this.buffer.byteLength - this.bufferOffset;
      const toCopy = Math.min(remainingInBuffer, length);
      buffer.set(this.buffer.subarray(this.bufferOffset, this.bufferOffset + toCopy), offset);
      this.bufferOffset += toCopy;
      totalBytesRead += toCopy;
      length -= toCopy;
      offset += toCopy;

      // If the buffer is exhausted, clear it
      if (this.bufferOffset >= this.buffer.byteLength) {
        this.buffer = null;
        this.bufferOffset = 0;
      }
    }

    // Continue reading from the stream if more data is needed
    while (length > 0 && !this.endOfStream) {
      const result = await this.reader.read();

      if (result.done) {
        this.endOfStream = true;
        break;
      }

      if (result.value) {
        const chunk = result.value;

        // If the chunk is larger than the requested length, store the excess
        if (chunk.byteLength > length) {
          buffer.set(chunk.subarray(0, length), offset);
          this.buffer = chunk;
          this.bufferOffset = length; // Keep track of the unconsumed part
          totalBytesRead += length;
          return totalBytesRead;
        }

        // Otherwise, consume the entire chunk
        buffer.set(chunk, offset);
        totalBytesRead += chunk.byteLength;
        length -= chunk.byteLength;
        offset += chunk.byteLength;
      }
    }

    if (totalBytesRead === 0 && this.endOfStream) {
      throw new EndOfStreamError();
    }

    return totalBytesRead;
  }

  public abort(): Promise<void> {
    return this.reader.cancel();
  }

  public async close(): Promise<void> {
    await this.abort();
    this.reader.releaseLock();
  }
}
