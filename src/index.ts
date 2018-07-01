import * as assert from "assert";
import {Promise} from "es6-promise";
import * as stream from "stream";

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

/**
 * Error message
 */
export const endOfStream = "End-Of-Stream";

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
      throw new Error("Expected an instance of stream.Readable");
    }
    this.s.once("end", () => {
      this.endOfStream = true;
      if (this.request) {
        this.request.deferred.reject(new Error(endOfStream));
        this.request = null;
      }
    });
  }

  /**
   * Read ahead (peek) from stream. Subsequent read or peeks will return the same data
   * @param buffer Buffer to store data read from stream in
   * @param offset Offset buffer
   * @param length Number of bytes to read
   * @param position Source offset
   * @returns {any}
   */
  public peek(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {
    return this.read(buffer, offset, length).then(bytesRead => {
      this.peekQueue.unshift(buffer.slice(offset, bytesRead) as Buffer);
      return bytesRead;
    });
  }

  /**
   * Read chunk from stream
   * @param buffer Target buffer to store data read from stream in
   * @param offset Offset of target buffer
   * @param length Number of bytes to read
   * @returns {any}
   */
  public read(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {
    if (length === 0) {
      return Promise.resolve(0);
    }
    if (this.peekQueue.length > 0) {
      const peekData = this.peekQueue.shift();
      if (length <= peekData.length) {
        peekData.copy(buffer as Buffer, offset, 0, length);
        if (length < peekData.length) {
          this.peekQueue.unshift(peekData.slice(length));
        }
        return Promise.resolve(length);
      } else {
        peekData.copy(buffer as Buffer, offset);
        return this.read(buffer, offset + peekData.length, length - peekData.length).then(bytesRead => {
          return peekData.length + bytesRead;
        }).catch(err => {
          if (err.message === endOfStream) {
            return peekData.length; // Return partial read
          } else throw err;
        });
      }
    } else {
      return this._read(buffer, offset, length);
    }
  }

  /**
   * Read chunk from stream
   * @param buffer Buffer to store data read from stream in
   * @param offset Offset buffer
   * @param length Number of bytes to read
   * @returns {any}
   */
  private _read(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {

    assert.ok(!this.request, "Concurrent read operation?");

    if (this.endOfStream) {
      return Promise.reject(new Error(endOfStream));
    }

    const readBuffer = this.s.read(length);

    if (readBuffer) {
      readBuffer.copy(buffer, offset);
      return Promise.resolve<number>(readBuffer.length);
    } else {
      this.request = {
        buffer,
        offset,
        length,
        deferred: new Deferred<number>()
      };
      this.s.once("readable", () => {
        this.tryRead();
      });
      return this.request.deferred.promise.then(n => {
        this.request = null;
        return n;
      }).catch(err => {
        this.request = null;
        throw err;
      });
    }
  }

  private tryRead() {
    const readBuffer = this.s.read(this.request.length);
    if (readBuffer) {
      readBuffer.copy(this.request.buffer, this.request.offset);
      this.request.deferred.resolve(readBuffer.length);
    } else {
      this.s.once("readable", () => {
        this.tryRead();
      });
    }
  }
}
