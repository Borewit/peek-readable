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

##### TypeScript:
```JavaScript
import {StreamReader} from "then-read-stream";

const readThisStream = ... // Some stream of type stream.Readable
const streamReader = new StreamReader(readThisStream);

const buf = new Buffer(16);
  
return streamReader.read(buf, 0, 16).then((bytesRead) => {
    // If all went well, buf contains the promised 16 bytes of data read
  }).catch((err) => {
    if(err === StreamReader.EndOfStream) {
      // Rejected, bacause end of the stream has been reached
    }
  })
```
##### JavaScript:
```JavaScript
var stream_reader = require("then-read-stream");

var readThisStream = ... // Some stream of type stream.Readable
var streamReader = new stream_reader.StreamReader(readThisStream);

return streamReader.read(buf, 0, 16).then( function(bytesRead) {
    // If all went well, buf contains the promised 16 bytes of data read
  }).catch( function(err) {
    if(err === stream_reader.StreamReader.EndOfStream) {
      // Rejected, bacause end of the stream has been reached
    }
  })

```



[npm-url]: https://npmjs.org/package/then-read-stream
[npm-image]: https://badge.fury.io/js/then-read-stream.svg
[npm-downloads-image]: http://img.shields.io/npm/dm/then-read-stream.svg

[travis-url]: https://travis-ci.org/Borewit/then-read-stream
[travis-image]: https://api.travis-ci.org/Borewit/then-read-stream.svg?branch=master