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
 * Used to reject read if end-of-stream has been reached
 * @type {Error}
 */
export const EndOfStream = new Error("End-Of-Stream");

export class StreamReader {

  /**
   * Obsolete: use module EndOfStream instead
   */
  public static EndOfStream = EndOfStream;

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
    this.s.once("end", () => {
      this.endOfStream = true;
      if (this.request) {
        this.request.deferred.reject(EndOfStream);
        this.request = null;
      }
    });
  }

  /**
   * Read ahead from stream. Subsequent read will return the same data
   * @param buffer Buffer to store data read from stream in
   * @param offset Offset buffer
   * @param length Number of bytes to read
   * @param position
   * @returns {any}
   */
  public peek(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {
    return this.read(buffer, offset, length).then((bytesRead) => {
      this.peekQueue.push(buffer.slice(offset, length) as Buffer);
      return bytesRead;
    });
  }

  /**
   * Read chunk from stream
   * @param buffer Buffer to store data read from stream in
   * @param offset Offset buffer
   * @param length Number of bytes to read
   * @returns {any}
   */
  public read(buffer: Buffer | Uint8Array, offset: number, length: number): Promise<number> {
    if (this.peekQueue.length > 0) {
      const peekData = this.peekQueue.shift();
      if (length <= peekData.length) {
        peekData.copy(buffer as Buffer, offset, 0, offset + length);
        if (length < peekData.length) {
          this.peekQueue.unshift(peekData.slice(length));
        }
        return Promise.resolve(length);
      } else {
        peekData.copy(buffer as Buffer, offset);
        return this.read(buffer, offset + peekData.length, length - peekData.length).then((bytesRead) => {
          return peekData.length + bytesRead;
        }).catch((err) => {
          if (err === EndOfStream) {
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

    if (this.request)
      throw new Error("Concurrent read operation");

    if (this.endOfStream) {
      //return Promise.reject(StreamReader.EndOfStream);
      Promise.resolve<number>(0);
    }

    const readBuffer = this.s.read(length);

    if (readBuffer) {
      readBuffer.copy(buffer, offset);
      return Promise.resolve<number>(length);
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
      return this.request.deferred.promise.then((n) => {
        this.request = null;
        return n;
      }).catch((err) => {
        this.request = null;
        throw err;
      });
    }
  }

  private tryRead() {
    const readBuffer = this.s.read(this.request.length);
    if (readBuffer) {
      readBuffer.copy(this.request.buffer, this.request.offset);
      this.request.deferred.resolve(this.request.length);
    } else {
      this.s.once("readable", () => {
        this.tryRead();
      });
    }
  }
}
