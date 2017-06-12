[![Build Status][travis-image]][travis-url]

A promise based asynchronous stream reader.

Allows to read from a [Readable Stream](https://nodejs.org/api/stream.html#stream_readable_streams) 
similar as you would read from a file.

## Usage

The `stream-reader` contains one class: `StreamReader`.  The constructor of
the `StreamReader` if provided with the [stream.Readable](https://nodejs.org/api/stream.html#stream_class_stream_readable)
you want to read from.

```JavaScript
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

      
[npm-url]: https://npmjs.org/package/stream-reader
[npm-image]: https://badge.fury.io/js/stream-reader.svg

[travis-url]: https://travis-ci.org/profile/Borewit/stream-reader
[travis-image]: https://api.travis-ci.org/Borewit/stream-reader.svg?branch=master