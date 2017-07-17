// Utilities for testing

import {Readable} from "stream";

/**
 * A mock readable-stream, using string to read from
 */
export class SourceStream extends Readable {

  private buf: Buffer;

  constructor(private str: string = "") {
    super();

    this.buf = new Buffer(str, "binary");
  }

  public _read() {
    this.push(this.buf);
    this.push(null); // push the EOF-signaling `null` chunk
  }
}
