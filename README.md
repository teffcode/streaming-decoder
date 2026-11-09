# Streaming decoder

Reads chunked text as the pieces come in. `processChunk` can stop in the middle of a size, a payload, or a line break. `result` returns whatever has been decoded so far.

## Run

Node.js 18 or later. Nothing to install.

```sh
node --test streaming-decoder.test.js
```

```js
const { StreamingDecoder } = require('./streaming-decoder');
const decoder = new StreamingDecoder();

decoder.processChunk('7');
console.log(decoder.result()); // ''

decoder.processChunk('\r\nNewtonX\r\nB\r\n is hiring');
console.log(decoder.result()); // 'NewtonX is hiring'

decoder.processChunk(' \r\n8\r\nawesome \r\n9\r\nengineers\r\n0\r\n\r\n');
console.log(decoder.result()); // 'NewtonX is hiring awesome engineers'
```

## How it works

Between calls the decoder remembers where it left off and how many payload characters are still missing. The size stays a number, one digit at a time. Text is kept as soon as it arrives, even when the rest of that chunk shows up later.

A line break split across calls is just the next step, so the raw input does not have to be saved. A size of zero, followed by the closing line break, ends the stream.

The tests follow the example above, including input split into small pieces and a few malformed cases.
