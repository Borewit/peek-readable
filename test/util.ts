// Utilities for testing

import { Readable } from 'node:stream';
import { makeByteReadableStreamFromNodeReadable } from 'node-readable-to-web-readable-stream';

/**
 * A mock Node.js readable-stream, using string to read from
 */
export class SourceStream extends Readable {

  private readonly buf: Uint8Array;

  constructor(private str = '', private delay = 0) {
    super();

    this.buf = new TextEncoder().encode(str);
  }

  public _read() {
    setTimeout(() => {
      this.push(this.buf);
      this.push(null); // Signal end of stream
    }, this.delay);
  }
}

// Function to convert a string to a BYOB ReadableStream
function stringReadableStream(inputString: string, delay = 0): ReadableStream<Uint8Array> {
  // Convert the string to a Uint8Array using TextEncoder

  const nodeReadable = new SourceStream(inputString, delay);
  return makeByteReadableStreamFromNodeReadable(nodeReadable) as ReadableStream<Uint8Array>;
}

export function stringToReadableStream(inputString: string, forceDefault: boolean, delay?: number): ReadableStream<Uint8Array> {
  const stream = stringReadableStream(inputString, delay);
  const _getReader = stream.getReader.bind(stream);

  // @ts-ignore
  stream.getReader = (options?: { mode?: string }) => {
    if (forceDefault) {
      // Force returning the default reader
      return _getReader(); // Call without options for a default reader
    }
    // @ts-ignore
    return _getReader(options); // Pass through other options
  };

  return stream;
}
