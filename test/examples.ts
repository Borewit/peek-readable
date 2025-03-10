import { assert } from 'chai';
import * as fs from 'node:fs';
import { EndOfStreamError, StreamReader } from '../lib/index.js';

describe('Examples', () => {

  it('first example', async () => {

    const readable = fs.createReadStream(new URL('resources/JPEG_example_JPG_RIP_001.jpg', import.meta.url));
    const streamReader = new StreamReader(readable);
    const uint8Array = new Uint8Array(16);
    const bytesRead = await streamReader.read(uint8Array);
    assert.equal(bytesRead, 16);
  });

  it('End-of-stream detection', async () => {

    const fileReadStream = fs.createReadStream(new URL('resources/JPEG_example_JPG_RIP_001.jpg', import.meta.url));
    const streamReader = new StreamReader(fileReadStream);
    const uint8Array =  new Uint8Array(16);
    assert.equal(await streamReader.read(uint8Array), 16);
    try {
      while(await streamReader.read(uint8Array.subarray(0, 1)) > 0);
      assert.fail('Should throw Errors');
    } catch(error) {
      assert.isOk(error instanceof EndOfStreamError, 'Expect `error` to be instance of `Errors`');
      console.log('End-of-stream reached');
    }
  });

  it('peek', async () => {

    const fileReadStream = fs.createReadStream(new URL('resources/JPEG_example_JPG_RIP_001.jpg', import.meta.url));
    const streamReader = new StreamReader(fileReadStream);
    const buffer = new Uint8Array(20);

    let bytesRead = await streamReader.peek(buffer.subarray(0, 3));
    if (bytesRead === 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      console.log('This is a JPEG file');
    } else {
      throw new Error('Expected a JPEG file');
    }
    bytesRead = await streamReader.read(buffer); // Read JPEG header
    if (bytesRead === 20) {
      console.log('Got the JPEG header');
    } else {
      throw new Error('Failed to read JPEG header');
    }
  });

});
