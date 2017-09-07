import {assert} from "chai";
import * as fs from "fs-extra";
import {} from "mocha";
import * as Path from "path";
import {Readable} from "stream";
import {endOfStream, StreamReader} from "../src";
import {SourceStream} from "./util";

describe("StreamReader", () => {

  it("should be able to handle 0 byte read request", () => {

    const streamReader = new StreamReader(new SourceStream("abcdefg"));

    const buf = new Buffer(0);
    return streamReader.read(buf, 0, 0).then((bytesRead) => {
      assert.equal(bytesRead, 0, "Should return");
    });
  });

  describe("read from a streamed data chunk", () => {

    const sourceStream = new SourceStream("\x05peter");
    const streamReader = new StreamReader(sourceStream);

    it("read only one byte from the chunk", () => {

      const buf = new Buffer(1);
      return streamReader.read(buf, 0, 1).then((bytesRead) => {
        assert.equal(bytesRead, 1, "Should read exactly one byte");
        assert.equal(buf[0], 5, "0x05 == 5");
      });
    });

    it("should decode string from chunk", () => {

      const buf = new Buffer(5);
      return streamReader.read(buf, 0, 5).then((bytesRead) => {
        assert.equal(bytesRead, 5, "Should read 5 bytes");
        assert.equal(buf.toString(), "peter");
      });
    });

    it("should should reject at the end of the stream", () => {

      const buf = new Buffer(1);
      return streamReader.read(buf, 0, 1).then((bytesRead) => {
        assert.fail("Should reject due to end-of-stream");
      }).catch((err) => {
        assert.equal(err.message, endOfStream);
      });
    });
  });

  describe("concurrent reads", () => {

    function readByteAsNumber(sr: StreamReader): Promise<number> {
      const buf = new Buffer(1);
      return sr.read(buf, 0, 1).then(() => {
        return buf[0];
      });
    }

    it("should support concurrent reads", () => {

      const sourceStream = new SourceStream("\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09");
      const streamReader = new StreamReader(sourceStream);

      const prom: Array<Promise<number>> = [];

      for (let i = 0; i < 10; ++i) {
        prom.push(readByteAsNumber(streamReader));
      }

      return Promise.all(prom).then((res) => {
        for (let i = 0; i < 10; ++i) {
          assert.equal(res[i], i);
        }
      });

    });
  });

  describe("disjoint", () => {

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
      private buf: Buffer;

      public constructor(private lens: number[]) {

        super();

        let len: number = 0;

        for (const v of lens) {
          len += v;
        }

        this.nvals = Math.floor(len / 4);

        let data = "";
        for (let i = 0; i < this.nvals + 1; i++) {
          data += "\x01\x02\x03\x04";
        }
        this.buf = new Buffer(data, "binary");
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
    const s = new LensSourceStream(t);

    const sb = new StreamReader(s);

    const buf = new Buffer(4);

    const run = (): Promise<void> => {
      return sb.read(buf, 0, 4).then((bytesRead) => {
        assert.equal(bytesRead, 4);
        assert.equal(buf.readInt32BE(0), 16909060);
        if (--s.nvals > 0) {
          return run();
        }
      });
    };

    it("should parse disjoint", () => {

      return run();
    });

  });

  describe("peek", () => {

    it("should be able to read a peeked chunk", () => {

      const sourceStream = new SourceStream("\x05peter");
      const streamReader = new StreamReader(sourceStream);

      const buf = new Buffer(1);

      return streamReader.peek(buf, 0, 1)
        .then((bytesRead) => {
          assert.equal(bytesRead, 1, "Should peek exactly one byte");
          assert.equal(buf[0], 5, "0x05 == 5");
          return streamReader.read(buf, 0, 1);
        })
        .then((bytesRead) => {
          assert.equal(bytesRead, 1, "Should re-read the peaked byte");
          assert.equal(buf[0], 5, "0x05 == 5");
        });
    });

    it("should be able to read a larger chunk overlapping the peeked chunk", () => {

      const sourceStream = new SourceStream("\x05peter");
      const streamReader = new StreamReader(sourceStream);

      const buf = new Buffer(6).fill(0);

      return streamReader.peek(buf, 0, 1)
        .then((bytesRead) => {
          assert.equal(bytesRead, 1, "Should peek exactly one byte");
          assert.equal(buf[0], 5, "0x05 == 5");
          return streamReader.read(buf, 0, 6);
        })
        .then((bytesRead) => {
          assert.equal(bytesRead, 6, "Should overlap the peaked byte");
          assert.equal(buf, "\x05peter");
        });
    });

    it("should be able to read a smaller chunk then the overlapping peeked chunk", () => {

      const sourceStream = new SourceStream("\x05peter");
      const streamReader = new StreamReader(sourceStream);

      const buf = new Buffer(6).fill(0);

      return streamReader.peek(buf, 0, 2)
        .then((bytesRead) => {
          assert.equal(bytesRead, 2, "Should peek 2 bytes");
          assert.equal(buf[0], 5, "0x05 == 5");
          return streamReader.read(buf, 0, 1);
        })
        .then((bytesRead) => {
          assert.equal(bytesRead, 1, "Should read only 1 byte");
          assert.equal(buf[0], 5, "0x05 == 5");
          return streamReader.read(buf, 1, 5);
        })
        .then((bytesRead) => {
          assert.equal(bytesRead, 5, "Should read remaining 5 byte");
          assert.equal(buf, "\x05peter");
        });
    });

    it("should be able to handle overlapping peeks", () => {

      const sourceStream = new SourceStream("\x01\x02\x03\x04\x05");
      const streamReader = new StreamReader(sourceStream);

      const peekBuffer = new Buffer(3);
      const readBuffer = new Buffer(1);

      return streamReader.peek(peekBuffer, 0, 3) // Peek #1
        .then((len) => {
          assert.equal(3, len);
          assert.deepEqual(peekBuffer, new Buffer("\x01\x02\x03", "binary"), "Peek #1");
          return streamReader.read(readBuffer, 0, 1); // Read #1
        }).then((len) => {
          assert.equal(len, 1);
          assert.deepEqual(readBuffer, new Buffer("\x01", "binary"), "Read #1");
          return streamReader.peek(peekBuffer, 0, 3); // Peek #2
        }).then((len) => {
          assert.equal(len, 3);
          assert.deepEqual(peekBuffer, new Buffer("\x02\x03\x04", "binary"), "Peek #2");
          return streamReader.read(readBuffer, 0, 1); // Read #2
        }).then((len) => {
          assert.equal(len, 1);
          assert.deepEqual(readBuffer, new Buffer("\x02", "binary"), "Read #2");
          return streamReader.peek(peekBuffer, 0, 3); // Peek #3
        }).then((len) => {
          assert.equal(len, 3);
          assert.deepEqual(peekBuffer, new Buffer("\x03\x04\x05", "binary"), "Peek #3");
          return streamReader.read(readBuffer, 0, 1); // Read #3
        }).then((len) => {
          assert.equal(len, 1);
          assert.deepEqual(readBuffer, new Buffer("\x03", "binary"), "Read #3");
          return streamReader.peek(peekBuffer, 0, 3); // Peek #4
        }).then((len) => {
          assert.equal(len, 2, "3 bytes requested to peek, only 2 bytes left");
          assert.deepEqual(peekBuffer, new Buffer("\x04\x05\x05", "binary"), "Peek #4");
          return streamReader.read(readBuffer, 0, 1); // Read #4
        }).then((len) => {
          assert.equal(len, 1);
          assert.deepEqual(readBuffer, new Buffer("\x04", "binary"), "Read #4");
        });
    });
  });

  describe("EndOfStream Error", () => {

    it("should not throw an EndOfStream Error if we read exactly until the end of the stream", () => {

      const sourceStream = new SourceStream("\x89\x54\x40");
      const streamReader = new StreamReader(sourceStream);

      const res = new Buffer(3);

      return streamReader.peek(res, 0, 3)
        .then((len) => {
          assert.equal(3, len);
        });
    });

    it("should return a partial result from a stream if EOF is reached", () => {

      const sourceStream = new SourceStream("\x89\x54\x40");
      const streamReader = new StreamReader(sourceStream);

      const res = new Buffer(4);

      return streamReader.peek(res, 0, 4)
        .then((len) => {
          assert.equal(3, len, "should indicate only 3 bytes are actually peeked");
          return streamReader.read(res, 0, 4);
        }).then((len) => {
          assert.equal(3, len, "should indicate only 3 bytes are actually read");
        });
    });

  });

  describe("file-stream", () => {

    const path_test3 = Path.join(__dirname, "resources", "test3.dat");
    const fileSize = 5;
    const buf = new Buffer(17);

    it("should return a partial size, if full length cannot be read", () => {
      const fileReadStream = fs.createReadStream(path_test3);
      const streamReader = new StreamReader(fileReadStream);
      return streamReader.read(buf, 0, 17).then((actualRead) => {
        assert.strictEqual(actualRead, fileSize);
        fileReadStream.close();
      });
    });

  }); // number

});
