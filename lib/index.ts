import * as stream from 'stream';
import { EndOfStreamError } from './EndOfFileStream';
export { EndOfStreamError } from './EndOfFileStream';

interface IReadRequest {
  buffer: Uint8Array,
  offset: number,
  length: number,
  position?: number,
  deferred: Deferred<number>
}

class Deferred<T> {

  public promise: Promise<T>;
  public resolve: (value: T) => void = () => null;
  public reject: (reason: any) => void = () => null;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

const maxStreamReadSize = 1 * 1024 * 1024; // Maximum request length on read-stream operation

export class StreamReader {

  /**
   * Deferred read request
   */
  private request: IReadRequest | null = null;

  private endOfStream = false;

  /**
   * Store peeked data
   * @type {Array}
   */
  private peekQueue: Uint8Array[] = [];

  public constructor(private s: stream.Readable) {
    if (!s.read || !s.once) {
      throw new Error('Expected an instance of stream.Readable');
    }
    this.s.once('end', () => this.reject(new EndOfStreamError()));
    this.s.once('error', err => this.reject(err));
    this.s.once('close', () => this.reject(new Error('Stream closed')));
  }

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

    if (this.peekQueue.length === 0 && this.endOfStream) {
      throw new EndOfStreamError();
    }

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
    // continue reading from stream if required
    while (remaining > 0 && !this.endOfStream) {
      const reqLen = Math.min(remaining, maxStreamReadSize);
      const chunkLen = await this._read(buffer, offset + bytesRead, reqLen);
      bytesRead += chunkLen;
      if (chunkLen < reqLen)
        break;
      remaining -= chunkLen;
    }
    return bytesRead;
  }

  /**
   * Read chunk from stream
   * @param buffer Target Uint8Array (or Buffer) to store data read from stream in
   * @param offset Offset target
   * @param length Number of bytes to read
   * @returns Number of bytes read
   */
  private async _read(buffer: Uint8Array, offset: number, length: number): Promise<number> {

    if(this.request) throw new Error('Concurrent read operation?');

    const readBuffer = this.s.read(length);

    if (readBuffer) {
      buffer.set(readBuffer, offset);
      return readBuffer.length;
    } else {
      this.request = {
        buffer,
        offset,
        length,
        deferred: new Deferred<number>()
      };
      this.s.once('readable', () => {
        this.tryRead();
      });
      return this.request.deferred.promise;
    }
  }

  private tryRead() {
    if (!this.request) throw new Error('this.request should be defined');
    const readBuffer = this.s.read(this.request.length);
    if (readBuffer) {
      this.request.buffer.set(readBuffer, this.request.offset);
      this.request.deferred.resolve(readBuffer.length);
      this.request = null;
    } else {
      this.s.once('readable', () => {
        this.tryRead();
      });
    }
  }

  private reject(err: Error) {
    this.endOfStream = true;
    if (this.request) {
      this.request.deferred.reject(err);
      this.request = null;
    }
  }
}
