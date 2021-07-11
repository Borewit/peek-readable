import * as stream from 'stream';
import { EndOfStreamError } from './EndOfFileStream';
export { EndOfStreamError } from './EndOfFileStream';

interface IReadRequest {
  buffer: Buffer | Uint8Array,
  offset: number,
  length: number,
  position?: number,
  deferred: Deferred<number>
}

class Deferred<T> {

  public promise: Promise<T>;
  public resolve: (value: T) => void;
  public reject: (reason: any) => void;

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
  private request: IReadRequest;

  private endOfStream = false;

  /**
   * Store peeked data
   * @type {Array}
   */
  private peekQueue: Buffer[] = [];

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
   * @param buffer - Buffer to store data read from stream in
   * @param offset - Offset buffer
   * @param length - Number of bytes to read
   * @returns Number of bytes peeked
   */
  public async peek(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {
    const bytesRead = await this.read(buffer, offset, length);
    this.peekQueue.push(buffer.slice(offset, offset + bytesRead) as Buffer); // Put read data back to peek buffer
    return bytesRead;
  }

  /**
   * Read chunk from stream
   * @param buffer - Target buffer to store data read from stream in
   * @param offset - Offset of target buffer
   * @param length - Number of bytes to read
   * @returns Number of bytes read
   */
  public async read(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {
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
      const lenCopy = Math.min(peekData.length, remaining);
      peekData.copy(buffer, offset + bytesRead, 0, lenCopy);
      bytesRead += lenCopy;
      remaining -= lenCopy;
      if (lenCopy < peekData.length) {
        // remainder back to queue
        this.peekQueue.push(peekData.slice(lenCopy));
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
   * @param buffer Buffer to store data read from stream in
   * @param offset Offset buffer
   * @param length Number of bytes to read
   * @returns Number of bytes read
   */
  private async _read(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {

    if(this.request) throw new Error('Concurrent read operation?');

    const readBuffer = this.s.read(length);

    if (readBuffer) {
      readBuffer.copy(buffer, offset);
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
      return this.request.deferred.promise.then(n => {
        return n;
      }, err => {
        throw err;
      });
    }
  }

  private tryRead() {
    const readBuffer = this.s.read(this.request.length);
    if (readBuffer) {
      readBuffer.copy(this.request.buffer, this.request.offset);
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
