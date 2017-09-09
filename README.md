[![Build Status](https://travis-ci.org/Borewit/then-read-stream.svg?branch=master)](https://travis-ci.org/Borewit/then-read-stream)
[![NPM version](https://badge.fury.io/js/then-read-stream.svg)](https://npmjs.org/package/then-read-stream)
[![npm downloads](http://img.shields.io/npm/dm/then-read-stream.svg)](https://npmjs.org/package/then-read-stream)
[![Dependencies](https://david-dm.org/Borewit/then-read-stream.svg)](https://david-dm.org/Borewit/then-read-stream)
[![Coverage Status](https://coveralls.io/repos/github/Borewit/then-read-stream/badge.svg?branch=master)](https://coveralls.io/github/Borewit/then-read-stream?branch=master)


A promise based asynchronous stream reader, which makes reading from a stream easy.

Allows to read from a [Readable Stream](https://nodejs.org/api/stream.html#stream_readable_streams) 
similar as you would read from a file.

## Usage

The `then-read-stream` contains one class: `StreamReader`.  The constructor of
the `StreamReader` if provided with the [stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)
you want to read from.

##### Examles:

In the following example we read the first 16 bytes from a stream and store them in our buffer.

```JavaScript
var stream_reader = require("then-read-stream");

var readThisStream = ... // Some stream of type stream.Readable
var streamReader = new stream_reader.StreamReader(readThisStream);

var buffer = new Buffer(16);

return streamReader.read(buf, 0, 16)
  .then( function(bytesRead) {
    // If all went well, buf contains the promised 16 bytes of data read
  })
  .catch( function(err) {
    if(err === stream_reader.StreamReader.EndOfStream) {
      // Rejected, end of the stream has been reached
    }
  })

```

With peek you can read ahead:
```JavaScript
return streamReader.peek(buffer, 0, 1)
  .then( function(bytesRead) {
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
  .then( function(bytesIgnored) {
    if(bytesIgnored<16){
      console.log('Remaing stream length was %s, expected 16', bytesIgnored)
    }
  })
```

##### TypeScript:
TypeScript definitions are build in. No need to install additional modules.
```TypeScript
import {StreamReader} from "then-read-stream";

const readThisStream = ... // Some stream of type stream.Readable
const streamReader = new StreamReader(readThisStream);

const buf = new Buffer(16);
  
return streamReader.read(buf, 0, 16).then((bytesRead) => {
    // If all went well, buf contains the promised 16 bytes of data read
  }).catch((err) => {
    if(err === StreamReader.EndOfStream) {
      // Rejected, end of the stream has been reached
    }
  })
```

[npm-url]: https://npmjs.org/package/then-read-stream
[npm-image]: https://badge.fury.io/js/then-read-stream.svg
[npm-downloads-image]: http://img.shields.io/npm/dm/then-read-stream.svg

[travis-url]: https://travis-ci.org/Borewit/then-read-stream
[travis-image]: https://api.travis-ci.org/Borewit/then-read-stream.svg?branch=master