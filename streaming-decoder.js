'use strict';

// Sizes are hexadecimal. The payload is plain text, and a zero size ends the stream.
class StreamingDecoder {
  constructor() {
    this.chunks = [];
    this.state = 'SIZE';
    this.remainingBytes = 0;
    this.hasSizeDigit = false;
  }

  processChunk(input) {
    if (this.state === 'ERROR') {
      throw new Error('Decoder is in an error state. Create a new instance.');
    }
    if (typeof input !== 'string') {
      throw new TypeError('Expected an ASCII string.');
    }

    let position = 0;

    while (position < input.length) {
      // Consume available payload immediately, even if this call ends mid-chunk.
      if (this.state === 'PAYLOAD') {
        const availableBytes = input.length - position;
        const bytesToRead = Math.min(this.remainingBytes, availableBytes);
        const payload = input.slice(position, position + bytesToRead);

        this.chunks.push(payload);
        position += bytesToRead;
        this.remainingBytes -= bytesToRead;

        if (this.remainingBytes === 0) {
          this.state = 'PAYLOAD_CR';
        }
        continue;
      }

      const character = input[position];

      switch (this.state) {
        case 'SIZE': {
          if (character === '\r') {
            if (!this.hasSizeDigit) this.fail('Missing chunk size.');
            this.state = 'SIZE_LF';
            break;
          }

          const digit = parseInt(character, 16);
          if (Number.isNaN(digit)) this.fail('Invalid hexadecimal size.');

          // Accumulate the size without buffering the header text.
          const size = this.remainingBytes * 16 + digit;
          if (!Number.isSafeInteger(size)) this.fail('Chunk size is too large.');
          this.remainingBytes = size;
          this.hasSizeDigit = true;
          break;
        }
        case 'SIZE_LF':
          if (character !== '\n') this.fail('Expected LF after size.');
          if (this.remainingBytes === 0) {
            this.state = 'END_CR';
          } else {
            this.state = 'PAYLOAD';
          }
          break;
        case 'PAYLOAD_CR':
          if (character !== '\r') this.fail('Expected CR after payload.');
          this.state = 'PAYLOAD_LF';
          break;
        case 'PAYLOAD_LF':
          if (character !== '\n') this.fail('Expected LF after payload.');
          this.hasSizeDigit = false;
          this.state = 'SIZE';
          break;
        case 'END_CR':
          if (character !== '\r') this.fail('Expected final CR.');
          this.state = 'END_LF';
          break;
        case 'END_LF':
          if (character !== '\n') this.fail('Expected final LF.');
          this.state = 'DONE';
          break;
        case 'DONE':
          this.fail('Unexpected data after the end chunk.');
          break;
      }

      position++;
    }
  }

  result() {
    return this.chunks.join('');
  }

  fail(message) {
    this.state = 'ERROR';
    throw new Error(message);
  }
}

module.exports = { StreamingDecoder };
