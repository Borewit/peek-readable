// Utilities for testing

import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

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
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(inputString);

  let position = 0;

  // Create a BYOBReadableStream
  return new ReadableStream({
    type: 'bytes',
    async pull(controller) {
      // Check if there is data left to be pushed
      if (position < uint8Array.length) {
        const remaining = uint8Array.length - position;

        if (controller.byobRequest) {
          // BYOB path
          const view = (controller.byobRequest as ReadableStreamBYOBRequest).view as Uint8Array;
          const bytesRead = Math.min(remaining, view.byteLength);
          view.set(uint8Array.subarray(position, position + bytesRead));
          position += bytesRead;
          (controller.byobRequest as ReadableStreamBYOBRequest).respond(bytesRead);
        } else {
          // Non-BYOB path
          const chunk = uint8Array.subarray(position, position + remaining);
          position += remaining;

          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          controller.enqueue(chunk);
        }
      }

      // Close the stream if all data has been pushed
      if (position >= uint8Array.length) {
        controller.close();
      }
    },
    cancel() {
      // Handle stream cancellation
      position = uint8Array.length;
    }
  });
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
