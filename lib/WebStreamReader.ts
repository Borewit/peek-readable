// @ts-ignore
import { ReadableStream, ReadableStreamBYOBReader } from 'node:stream/web';
import { EndOfStreamError } from './EndOfFileStream.js';

export { EndOfStreamError } from './EndOfFileStream.js';

export class WebStreamReader {

  private reader: ReadableStreamBYOBReader;

  /**
   * Store peeked data
   * @type {Array}
   */
  private peekQueue: Uint8Array[] = [];

  public constructor(stream: ReadableStream) {
    this.reader = stream.getReader({mode: 'byob'}) as ReadableStreamBYOBReader;
  }

  /**
   * Read ahead (peek) from stream. Subsequent read or peeks will return the same data
   * @param buffer - Uint8Array (or Buffer) to store data read from stream in
   * @param offset - Offset target
   * @param length - Number of bytes to read
   * @returns Number of bytes peeked
   */
  public async peek(buffer: Uint8Array, offset: number, length: number): Promise<number> {
    const bytesRead = await this.read(buffer, offset, length);
    this.peekQueue.push(buffer.subarray(offset, offset + bytesRead)); // Put read data back to peek buffer
    return bytesRead;
  }

  /**
   * Read chunk from stream
   * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
   * @param offset - Offset target
   * @param length - Number of bytes to read
   * @returns Number of bytes read
   */
  public async read(buffer: Uint8Array, offset: number, length: number): Promise<number> {
    if (length === 0) {
      return 0;
    }
    const result = await this.reader.read(buffer);

    if (result.done) {
      throw new EndOfStreamError();
    }
    return length;
  }
}
