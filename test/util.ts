// Utilities for testing

import { Readable } from 'node:stream';
import { ReadableStream} from 'node:stream/web';

/**
 * A mock Node.js readable-stream, using string to read from
 */
export class SourceStream extends Readable {

  private buf: Uint8Array;

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
function stringToBYOBStream(inputString: string, delay = 0): ReadableStream<Uint8Array> {
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
        // Push the chunk to the controller
        if (controller.byobRequest) {
          const remaining = uint8Array.length - position;
          // @ts-ignore
          const v = controller.byobRequest.view;
          const bytesRead = Math.min(remaining, v.byteLength);
          v.set(uint8Array.subarray(position, position + bytesRead));
          position += bytesRead;
          // @ts-ignore
          controller.byobRequest.respond(bytesRead);
        } else {
          setTimeout(() => {
            controller.enqueue(uint8Array);
            position = uint8Array.length;
          }, delay);
        }
        if (position >= uint8Array.length) {
          controller.close();
        }
      }
    }
  });
}

// Function to convert a string to a ReadableStreamBYOBReader
export function stringToReadableStream(inputString: string, delay?: number): ReadableStream<Uint8Array> {
  return stringToBYOBStream(inputString, delay);
}
