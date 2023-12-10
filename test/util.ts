// Utilities for testing

import { Readable } from 'node:stream';
import { Blob } from 'node:buffer';

// @ts-ignore
import { ReadableStream, ReadableByteStreamController } from 'node:stream/web';


/**
 * A mock Node.js readable-stream, using string to read from
 */
export class SourceStream extends Readable {

  private buf: Buffer;

  constructor(private str: string = '') {
    super();

    this.buf = Buffer.from(str, 'latin1');
  }

  public _read() {
    this.push(this.buf);
    this.push(null); // push the EOF-signaling `null` chunk
  }
}

// /**
//  * Convert Uint8Array to ReadableStream
//  */
// function uint8ArrayToReadableStream(uint8Array: Uint8Array): ReadableStream<Uint8Array> {
//   let position = 0;
//   return new ReadableStream({
//     type: 'bytes',
//     start(controller) {},
//     async pull(controller) {
//       // Called when there is a pull request for data
//       // @ts-ignore
//       const theView = controller.byobRequest.view;
//       theView.set(uint8Array.subarray(position), theView.byteOffset, theView.byteLength);
//       // @ts-ignore
//       controller.byobRequest.respond(theView.byteLength);
//       position += theView.byteLength;
//     },
//     cancel(reason) {}
//   });
// }
//
// /**
//  * Convert string to ReadableStream
//  */
// export function stringToReadableStream(str: string) {
//   const buffer = Buffer.from(str, 'latin1');
//   return uint8ArrayToReadableStream(buffer);
// }

// Function to convert a string to a BYOB ReadableStream
function stringToBYOBStream(inputString: string): ReadableStream<Uint8Array> {
  // Convert the string to a Uint8Array using TextEncoder
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(inputString);

  let position = 0;

  // Create a BYOBReadableStream
  const stream = new ReadableStream({
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
          controller.enqueue(uint8Array);
          position = uint8Array.length;
        }
      } else {
        // If no more data is left, close the stream
        controller.close();
      }
    }
  });

  return stream;
}

// Function to convert a string to a ReadableStreamBYOBReader
export function stringToReadableStream(inputString: string): ReadableStream<Uint8Array> {
  return stringToBYOBStream(inputString);
}
