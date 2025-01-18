import { type ReadableStream as NodeReadableStream, ReadableStreamDefaultReader } from 'node:stream/web';
import { WebStreamByobReader } from './WebStreamByobReader.js';
import { WebStreamDefaultReader } from './WebStreamDefaultReader.js';

export type AnyWebByteStream = NodeReadableStream<Uint8Array> | ReadableStream<Uint8Array> | ReadableStream;

export function makeWebStreamReader(stream: AnyWebByteStream): WebStreamByobReader | WebStreamDefaultReader {
    const reader = stream.getReader({mode: "byob"});
    if (reader instanceof ReadableStreamDefaultReader) {
      return new WebStreamDefaultReader(reader as ReadableStreamDefaultReader);
    }
    // Fall back on default reader
    return new WebStreamByobReader(reader);
}
