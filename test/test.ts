// Test reading an array of bytes.

import {assert} from "chai";
import {} from "mocha";
import {Readable} from "stream";
import {StreamReader} from "../lib";
import {SourceStream} from "./util";

describe("ReadStreamTokenizer", () => {

  describe("buffer", () => {

    const sourceStream = new SourceStream("\x05peter");
    const streamReader = new StreamReader(sourceStream);

    it("Read only one byte from the chunck", () => {

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
        assert.equal(err, StreamReader.EndOfStream);
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
        })
        .then(() => {
          return streamReader.read(buf, 0, 1).then((bytesRead) => {
            assert.equal(bytesRead, 1, "Should re-read the peaked byte");
            assert.equal(buf[0], 5, "0x05 == 5");
          });
        });
    });

    it("should be able to read a larger chunk overlapping the peeked chunk", () => {

      const sourceStream = new SourceStream("\x05peter");
      const streamReader = new StreamReader(sourceStream);

      const buf = new Buffer(6);

      return streamReader.peek(buf, 0, 1)
        .then((bytesRead) => {
          assert.equal(bytesRead, 1, "Should peek exactly one byte");
          assert.equal(buf[0], 5, "0x05 == 5");
        })
        .then(() => {
          return streamReader.read(buf, 0, 6).then((bytesRead) => {
            assert.equal(bytesRead, 6, "Should overlap the peaked byte");
            assert.equal(buf, "\x05peter");
          });
        });
    });
  });

});
