[![Build Status](https://travis-ci.org/Borewit/then-read-stream.svg?branch=master)](https://travis-ci.org/Borewit/then-read-stream)
[![NPM version](https://badge.fury.io/js/then-read-stream.svg)](https://npmjs.org/package/then-read-stream)
[![npm downloads](http://img.shields.io/npm/dm/then-read-stream.svg)](https://npmjs.org/package/then-read-stream)
[![Dependencies](https://david-dm.org/Borewit/then-read-stream.svg)](https://david-dm.org/Borewit/then-read-stream)
[![Coverage Status](https://coveralls.io/repos/github/Borewit/then-read-stream/badge.svg?branch=master)](https://coveralls.io/github/Borewit/then-read-stream?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/Borewit/then-read-stream/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Borewit/then-read-stream?targetFile=package.json)
![npm bundle size (minified)](https://img.shields.io/bundlephobia/min/react.svg)

A promise based asynchronous stream reader, which makes reading from a stream easy.

Allows to read from a [Readable Stream](https://nodejs.org/api/stream.html#stream_readable_streams) 
similar as you would read from a file.

## Usage

The `then-read-stream` contains one class: `StreamReader`.
`StreamReader` iis constructed with the [stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)
you want to read from.

### Compatibility

NPM module is compliant with [ECMAScript 2015 (ES6)](https://www.ecma-international.org/ecma-262/6.0/).

##### Examples:

In the following example we read the first 16 bytes from a stream and store them in our buffer.

```JavaScript
import * as trs from 'then-read-stream';

const readble = ... // Some stream of type stream.Readable

const streamReader = new trs.StreamReader(readble);

const buffer = new Buffer(16);

return streamReader.read(buf, 0, 16)
  .then( bytesRead => {
    // If all went well, buf contains the promised 16 bytes of data read
  })
  .catch( err => {
    if(err.message === streamReader.endOfStream) {
      // Rejected, end of the stream has been reached
    }
  })

```

With peek you can read ahead:
```JavaScript

return streamReader.peek(buffer, 0, 1)
  .then( bytesRead => {
    if(bytesRead !== 2 || buffer[0] !== 0xFF){
      throw new Error('Stream should start with 0xFF');
    }
    // Read 16 bytes, start at the same offset as peek, so the first byte will be 0xFF
    return streamReader.peek(buffer, 0, 16);
  })
```

If you have to skip a part of the data, you can use ignore:
```JavaScript
return streamReader.ignore(16)
  .then( bytesIgnored => {
    if (bytesIgnored < 16){
      console.log(`Remaining stream length was ${bytesIgnored}, expected 16`);
    }
  })
```

##### TypeScript:
TypeScript definitions are build in. No need to install additional modules.
```TypeScript
import {StreamReader, endOfStream} from "then-read-stream";

const readThisStream = ... // Some stream of type stream.Readable
const streamReader = new StreamReader(readThisStream);

const buf = new Buffer(16);
  
return streamReader.read(buf, 0, 16).then(bytesRead => {
    // If all went well, buf contains the promised 16 bytes of data read
  }).catch(err => {
    if(err.message === endOfStream) {
      // Rejected, end of the stream has been reached
    }
  })
```
