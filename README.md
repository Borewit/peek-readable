[![Build Status](https://travis-ci.org/Borewit/then-read-stream.svg?branch=master)](https://travis-ci.org/Borewit/then-read-stream)
[![NPM version](https://badge.fury.io/js/then-read-stream.svg)](https://npmjs.org/package/then-read-stream)
[![npm downloads](http://img.shields.io/npm/dm/then-read-stream.svg)](https://npmjs.org/package/then-read-stream)
[![Dependencies](https://david-dm.org/Borewit/then-read-stream.svg)](https://david-dm.org/Borewit/then-read-stream)
[![Coverage Status](https://coveralls.io/repos/github/Borewit/then-read-stream/badge.svg?branch=master)](https://coveralls.io/github/Borewit/then-read-stream?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8a89b90858734a6da07570eaf2e89849)](https://www.codacy.com/app/Borewit/then-read-stream?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=Borewit/then-read-stream&amp;utm_campaign=Badge_Grade)
[![Known Vulnerabilities](https://snyk.io/test/github/Borewit/then-read-stream/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Borewit/then-read-stream?targetFile=package.json)

# then-read-stream

A promise based asynchronous stream reader, which makes reading from a stream easy.

Allows to read from a [Readable Stream](https://nodejs.org/api/stream.html#stream_readable_streams) 
similar as you would read from a file.

## Usage

The `then-read-stream` contains one class: `StreamReader`, which reads from a [stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable).

### Compatibility

NPM module is compliant with [ECMAScript 2015 (ES6)](https://www.ecma-international.org/ecma-262/6.0/).

#### Examples

In the following example we read the first 16 bytes from a stream and store them in our buffer.
Source code of examples can be found [here](test/examples.ts).

```JavaScript
import * as fs from 'fs';
import * as path from 'path';
import { StreamReader } from 'then-read-stream';

const readable = fs.createReadStream('JPEG_example_JPG_RIP_001.jpg');
const streamReader = new StreamReader(readable);

const buffer = Buffer.alloc(16);

return streamReader.read(buffer, 0, 16)
  .then( bytesRead => {
    // buf, contains bytesRead, which will be 16 if the end-of-stream has not been reached
  });
```

With peek you can read ahead:
```JavaScript
import * as fs from 'fs';
import * as path from 'path';
import { StreamReader } from 'then-read-stream';

const fileReadStream = fs.createReadStream('JPEG_example_JPG_RIP_001.jpg');
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
```

If you have to skip a part of the data, you can use ignore:
```JavaScript
return streamReader.ignore(16)
  .then( bytesIgnored => {
    if (bytesIgnored < 16){
      console.log(`Remaining stream length was ${bytesIgnored}, expected 16`);
    }
  });
```

