import { EndOfStreamError } from "./EndOfStreamError.js";


export interface IStreamReader {
  peek(uint8Array: Uint8Array, offset: number, length: number): Promise<number>;
  read(buffer: Uint8Array, offset: number, length: number): Promise<number>
}

export abstract class AbstractStreamReader implements IStreamReader {

  /**
   * Maximum request length on read-stream operation
   */
  protected maxStreamReadSize = 1 * 1024 * 1024;
  protected endOfStream = false;

  /**
   * Store peeked data
   * @type {Array}
   */
  protected peekQueue: Uint8Array[] = [];

  /**
   * Read ahead (peek) from stream. Subsequent read or peeks will return the same data
   * @param uint8Array - Uint8Array (or Buffer) to store data read from stream in
   * @param offset - Offset target
   * @param length - Number of bytes to read
   * @returns Number of bytes peeked
   */
  public async peek(uint8Array: Uint8Array, offset: number, length: number): Promise<number> {
    const bytesRead = await this.read(uint8Array, offset, length);
    this.peekQueue.push(uint8Array.subarray(offset, offset + bytesRead)); // Put read data back to peek buffer
    return bytesRead;
  }

  public async read(buffer: Uint8Array, offset: number, length: number): Promise<number> {
    if (length === 0) {
      return 0;
    }

    let bytesRead = this.readFromPeekBuffer(buffer, offset, length);
    bytesRead += await this.readRemainderFromStream(buffer, offset + bytesRead, length - bytesRead);
    if (bytesRead === 0) {
      throw new EndOfStreamError();
    }
    return bytesRead;
  }

  /**
   * Read chunk from stream
   * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
   * @param offset - Offset target
   * @param length - Number of bytes to read
   * @returns Number of bytes read
   */
  protected readFromPeekBuffer(buffer: Uint8Array, offset: number, length: number): number {

    let remaining = length;
    let bytesRead = 0;
    // consume peeked data first
    while (this.peekQueue.length > 0 && remaining > 0) {
      const peekData = this.peekQueue.pop(); // Front of queue
      if (!peekData) throw new Error('peekData should be defined');
      const lenCopy = Math.min(peekData.length, remaining);
      buffer.set(peekData.subarray(0, lenCopy), offset + bytesRead);
      bytesRead += lenCopy;
      remaining -= lenCopy;
      if (lenCopy < peekData.length) {
        // remainder back to queue
        this.peekQueue.push(peekData.subarray(lenCopy));
      }
    }
    return bytesRead;
  }

  public async readRemainderFromStream(buffer: Uint8Array, offset: number, remaining: number): Promise<number> {

    let bytesRead = 0;
    // Continue reading from stream if required
    while (remaining > 0 && !this.endOfStream) {
      const reqLen = Math.min(remaining, this.maxStreamReadSize);
      const chunkLen = await this.readFromStream(buffer, offset + bytesRead, reqLen);
      if (chunkLen === 0)
        break;
      bytesRead += chunkLen;
      remaining -= chunkLen;
    }
    return bytesRead;
  }

  protected abstract readFromStream(buffer: Uint8Array, offset: number, length: number): Promise<number>;
}
