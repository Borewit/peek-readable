import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {EventEmitter} from 'node:events';
import * as fs from 'node:fs';
import {Readable} from 'node:stream';
import {EndOfStreamError, type IStreamReader, StreamReader, WebStreamReader} from '../lib/index.js';
import {SourceStream, stringToReadableStream} from './util.js';


type StringToStreamFactory = (input: string) => IStreamReader;

interface StreamFactorySuite {
  description: string;
  fromString: StringToStreamFactory;
}

const latin1TextDecoder = new TextDecoder('latin1');

describe('Matrix', () => {

  const streamFactories: StreamFactorySuite[] = [{
    description: 'Node.js StreamReader',
    fromString: input => new StreamReader(new SourceStream(input))
  }, {
    description: 'WebStream Reader',
    fromString: input => new WebStreamReader(stringToReadableStream(input))
  }];

  streamFactories
    // .filter((q, n) => n===1)
    .forEach(factory => {
      describe(factory.description, () => {

        it('should be able to handle 0 byte read request', async () => {
          const streamReader = factory.fromString('abcdefg');

          const buf = new Uint8Array(0);
          const bytesRead = await streamReader.read(buf, 0, 0);
          assert.strictEqual(bytesRead, 0, 'Should return');
        });

        it('read from a streamed data chunk', async () => {
          const streamReader = factory.fromString('\x05peter');

          let uint8Array: Uint8Array;
          let bytesRead: number;

          // read only one byte from the chunk
          uint8Array = new Uint8Array(1);
          bytesRead = await streamReader.read(uint8Array, 0, 1);
          assert.strictEqual(bytesRead, 1, 'Should read exactly one byte');
          assert.strictEqual(uint8Array[0], 5, '0x05 == 5');

          // should decode string from chunk
          uint8Array = new Uint8Array(5);
          bytesRead = await streamReader.read(uint8Array, 0, 5);
          assert.strictEqual(bytesRead, 5, 'Should read 5 bytes');
          assert.strictEqual(new TextDecoder('latin1').decode(uint8Array), 'peter');

          // should should reject at the end of the stream
          uint8Array = new Uint8Array(1);
          try {
            await streamReader.read(uint8Array, 0, 1);
            assert.fail('Should reject due to end-of-stream');
          } catch (err) {
            assert.ok(err instanceof EndOfStreamError, 'Expect `err` to be instance of `EndOfStreamError`');
          }
        });

        describe('concurrent reads', () => {

          async function readByteAsNumber(sr: IStreamReader): Promise<number> {
            const uint8Array = new Uint8Array(1);
            await sr.read(uint8Array, 0, 1);
            return uint8Array[0];
          }

          it('should support concurrent reads', () => {

            const streamReader = factory.fromString('\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09');

            const prom: Promise<number>[] = [];

            for (let i = 0; i < 10; ++i) {
              prom.push(readByteAsNumber(streamReader));
            }

            return Promise.all(prom).then(res => {
              for (let i = 0; i < 10; ++i) {
                assert.strictEqual(res[i], i);
              }
            });

          });
        });

        describe('peek', () => {

          it('should be able to read a peeked chunk', async () => {

            const streamReader = factory.fromString('\x05peter');

            const uint8Array = new Uint8Array(1);

            let bytesRead = await streamReader.peek(uint8Array, 0, 1);
            assert.strictEqual(bytesRead, 1, 'Should peek exactly one byte');
            assert.strictEqual(uint8Array[0], 5, '0x05 == 5');
            bytesRead = await streamReader.read(uint8Array, 0, 1);
            assert.strictEqual(bytesRead, 1, 'Should re-read the peaked byte');
            assert.strictEqual(uint8Array[0], 5, '0x05 == 5');
          });

          it('should be able to read a larger chunk overlapping the peeked chunk', async () => {

            const streamReader = factory.fromString('\x05peter');

            const uint8Array = new Uint8Array(6).fill(0);

            let bytesRead = await streamReader.peek(uint8Array, 0, 1);
            assert.strictEqual(bytesRead, 1, 'Should peek exactly one byte');
            assert.strictEqual(uint8Array[0], 5, '0x05 == 5');
            bytesRead = await streamReader.read(uint8Array, 0, 6);
            assert.strictEqual(bytesRead, 6, 'Should overlap the peaked byte');
            assert.strictEqual(latin1TextDecoder.decode(uint8Array.buffer), '\x05peter');
          });

          it('should be able to read a smaller chunk then the overlapping peeked chunk', async () => {

            const streamReader = factory.fromString('\x05peter');

            const uint8Array = new Uint8Array(6).fill(0);

            let bytesRead = await streamReader.peek(uint8Array, 0, 2);
            assert.strictEqual(bytesRead, 2, 'Should peek 2 bytes');
            assert.strictEqual(uint8Array[0], 5, '0x05 == 5');
            bytesRead = await streamReader.read(uint8Array, 0, 1);
            assert.strictEqual(bytesRead, 1, 'Should read only 1 byte');
            assert.strictEqual(uint8Array[0], 5, '0x05 == 5');
            bytesRead = await streamReader.read(uint8Array, 1, 5);
            assert.strictEqual(bytesRead, 5, 'Should read remaining 5 byte');
            assert.strictEqual(latin1TextDecoder.decode(uint8Array), '\x05peter');
          });

          it('should be able to handle overlapping peeks', async () => {

            const streamReader = factory.fromString('\x01\x02\x03\x04\x05');

            const peekBufferShort = new Uint8Array(1);
            const peekBuffer = new Uint8Array(3);
            const readBuffer = new Uint8Array(1);

            let len = await streamReader.peek(peekBuffer, 0, 3); // Peek #1
            assert.equal(3, len);
            assert.deepEqual(peekBuffer, new Uint8Array([0x01, 0x02, 0x03]), 'Peek #1');
            len = await streamReader.peek(peekBufferShort, 0, 1); // Peek #2
            assert.equal(1, len);
            assert.deepEqual(peekBufferShort, new Uint8Array([0x01]), 'Peek #2');
            len = await streamReader.read(readBuffer, 0, 1); // Read #1
            assert.equal(len, 1);
            assert.deepEqual(readBuffer, new Uint8Array([0x01]), 'Read #1');
            len = await streamReader.peek(peekBuffer, 0, 3); // Peek #3
            assert.equal(len, 3);
            assert.deepEqual(peekBuffer, new Uint8Array([0x02, 0x03, 0x04]), 'Peek #3');
            len = await streamReader.read(readBuffer, 0, 1); // Read #2
            assert.equal(len, 1);
            assert.deepEqual(readBuffer, new Uint8Array([0x02]), 'Read #2');
            len = await streamReader.peek(peekBuffer, 0, 3); // Peek #3
            assert.equal(len, 3);
            assert.deepEqual(peekBuffer, new Uint8Array([0x03, 0x04, 0x05]), 'Peek #3');
            len = await streamReader.read(readBuffer, 0, 1); // Read #3
            assert.equal(len, 1);
            assert.deepEqual(readBuffer, new Uint8Array([0x03]), 'Read #3');
            len = await streamReader.peek(peekBuffer, 0, 2); // Peek #4
            assert.equal(len, 2, '3 bytes requested to peek, only 2 bytes left');
            assert.deepEqual(peekBuffer, new Uint8Array([0x04, 0x05, 0x05]), 'Peek #4');
            len = await streamReader.read(readBuffer, 0, 1); // Read #4
            assert.equal(len, 1);
            assert.deepEqual(readBuffer, new Uint8Array([0x04]), 'Read #4');
          });
        });

        describe('EndOfStream Error', () => {

          it('should not throw an EndOfStream Error if we read exactly until the end of the stream', async () => {

            const streamReader = factory.fromString('123');

            const res = new Uint8Array(3);

            const len = await streamReader.peek(res, 0, 3);
            assert.equal(len, 3);
          });

          it.skip('should return a partial result from a stream if EOF is reached', async () => {

            const streamReader = factory.fromString('123');

            const res = new Uint8Array(4);

            let len = await streamReader.peek(res, 0, 4);
            assert.equal(len, 3, 'should indicate only 3 bytes are actually peeked');
            len = await streamReader.read(res, 0, 4);
            assert.equal(len, 3, 'should indicate only 3 bytes are actually read');
          });

        });

        describe('file-stream', () => {

          const fileSize = 5;
          const uint8Array = new Uint8Array(17);

          it('should return a partial size, if full length cannot be read', async () => {
            const fileReadStream = fs.createReadStream(new URL('resources/test3.dat', import.meta.url));
            const streamReader = new StreamReader(fileReadStream);
            const actualRead = await streamReader.read(uint8Array, 0, 17);
            assert.strictEqual(actualRead, fileSize);
            fileReadStream.close();
          });

        });

        describe('exception', () => {

          const uint8Array = new Uint8Array(17);

          it('handle stream closed', async () => {
            const fileReadStream = fs.createReadStream(new URL('resources/test3.dat', import.meta.url));
            const streamReader = new StreamReader(fileReadStream);
            fileReadStream.close(); // Sabotage stream

            try {
              await streamReader.read(uint8Array, 0, 17);
              assert.fail('Should throw an exception');
            } catch (err: unknown) {
              if (err instanceof Error) {
                assert.strictEqual(err.message, 'Stream closed');
              } else {
                assert.fail('Should throw an exception');
              }
            }
          });

          it('handle stream error', async () => {

            const fileReadStream = fs.createReadStream(new URL('resources/file-does-not-exist', import.meta.url));
            const streamReader = new StreamReader(fileReadStream);

            try {
              await streamReader.read(uint8Array, 0, 17);
              assert.fail('Should throw an exception');
            } catch (err) {
              if (err instanceof Error) {
                assert.strictEqual((err as Error & { code: string }).code, 'ENOENT');
              } else {
                assert.fail('Should throw an exception');
              }
            }
          });

        });

      });
    });

});

describe('Node.js StreamReader', () => {

  it('should throw an exception if constructor argument is not a stream', () => {
    class MyEmitter extends EventEmitter {
    }

    const not_a_stream = new MyEmitter();

    assert.throws(() => {
      new StreamReader(not_a_stream as unknown as Readable);
    }, Error, 'Expected an instance of stream.Readable');
  });

  describe('disjoint', () => {

    const TESTTAB = [
      [1, 1, 1, 1],
      [4],
      [1, 1, 1, 1, 4],
      [2, 2],
      [3, 3, 3, 3],
      [1, 4, 3],
      [5],
      [5, 5, 5]
    ];

    // A net.Stream workalike that emits the indefinitely repeating string
    // '\x01\x02\x03\x04' in chunks specified by the 'lens' array param.
    class LensSourceStream extends Readable {

      public nvals: number;
      private buf: Uint8Array;

      public constructor(private lens: number[]) {

        super();

        let len = 0;

        for (const v of lens) {
          len += v;
        }

        this.nvals = Math.floor(len / 4);

        let data = '';
        for (let i = 0; i < this.nvals + 1; i++) {
          data += '\x01\x02\x03\x04';
        }
        this.buf = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      }

      public _read() {
        if (this.lens.length === 0) {
          this.push(null); // push the EOF-signaling `null` chunk
          return;
        }

        const l = this.lens.shift();
        const b = this.buf.slice(0, l);
        this.buf = this.buf.slice(l, this.buf.length);

        this.push(b);
      }
    }

    const t = TESTTAB.shift();
    if (!t) return;
    const s = new LensSourceStream(t);

    const sb = new StreamReader(s);

    const uint8Array = new Uint8Array(4);

    const run = (): Promise<void> => {
      return sb.read(uint8Array, 0, 4).then(bytesRead => {
        assert.strictEqual(bytesRead, 4);
        assert.strictEqual(new DataView(uint8Array.buffer).getUint32(0, false), 16909060);
        if (--s.nvals > 0) {
          return run();
        }
      });
    };

    it('should parse disjoint', () => {
      return run();
    });

  });

  describe('file-stream', () => {

    const fileSize = 5;
    const uint8Array = new Uint8Array(17);

    it('should return a partial size, if full length cannot be read', async () => {
      const fileReadStream = fs.createReadStream(new URL('resources/test3.dat', import.meta.url));
      const streamReader = new StreamReader(fileReadStream);
      const actualRead = await streamReader.read(uint8Array, 0, 17);
      assert.strictEqual(actualRead, fileSize);
      fileReadStream.close();
    });

  });

});

