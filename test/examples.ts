/* tslint:disable:no-console */

import { assert, expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { StreamReader } from '../src';

describe('Examples', () => {

  it('first example', () => {

    const readable = fs.createReadStream(path.join(__dirname, 'resources', 'JPEG_example_JPG_RIP_001.jpg'));
    const streamReader = new StreamReader(readable);

    const buffer = Buffer.alloc(16);

    return streamReader.read(buffer, 0, 16)
      .then(bytesRead => {
        assert.equal(bytesRead, 16);
        // buf, contains bytesRead, which will be 16 if the end-of-stream has not been reached
      });
  });

  it('peek', () => {

    const fileReadStream = fs.createReadStream(path.join(__dirname, 'resources', 'JPEG_example_JPG_RIP_001.jpg'));
    const streamReader = new StreamReader(fileReadStream);
    const buffer = Buffer.alloc(20);

    return streamReader.peek(buffer, 0, 3)
      .then(bytesRead => {
        if (bytesRead === 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
          console.log('This is a JPEG file');
          return streamReader.read(buffer, 0, 20); // Read JPEG header
        } else {
          throw Error('Expected a JPEG file');
        }
      })
      .then(bytesRead => {
        if (bytesRead === 20) {
          console.log('Got the JPEG header');
        } else {
          throw Error('Failed to read JPEG header');
        }
      });
  });

});
