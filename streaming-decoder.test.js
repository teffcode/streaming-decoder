'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { StreamingDecoder } = require('./streaming-decoder');

const encoded = '7\r\nNewtonX\r\nB\r\n is hiring \r\n8\r\nawesome \r\n9\r\nengineers\r\n0\r\n\r\n';
const expected = 'NewtonX is hiring awesome engineers';

function decode(pieces) {
  const decoder = new StreamingDecoder();
  for (const piece of pieces) decoder.processChunk(piece);
  return decoder.result();
}

test('exercise example: every intermediate result, including trailing spaces', () => {
  const decoder = new StreamingDecoder();
  const steps = [
    ['7', ''],
    ['\r\nNewtonX\r\n', 'NewtonX'],
    ['B\r\n is hiring', 'NewtonX is hiring'],
    [' \r\n8\r\nawesome \r\n', 'NewtonX is hiring awesome '],
    ['9\r\nengineers\r\n', expected],
    ['0\r\n\r\n', expected],
  ];
  for (const [input, output] of steps) {
    decoder.processChunk(input);
    assert.equal(decoder.result(), output);
  }
});

test('multiple chunks in one call', () => {
  assert.equal(decode([encoded]), expected);
});

test('one character per call', () => {
  assert.equal(decode(encoded.split('')), expected);
});

test('every possible two-part split', () => {
  for (let split = 0; split <= encoded.length; split++) {
    assert.equal(decode([encoded.slice(0, split), encoded.slice(split)]), expected);
  }
});

test('every possible three-part split', () => {
  for (let first = 0; first <= encoded.length; first++) {
    for (let second = first; second <= encoded.length; second++) {
      assert.equal(decode([
        encoded.slice(0, first),
        encoded.slice(first, second),
        encoded.slice(second),
      ]), expected);
    }
  }
});

test('multi-digit and lowercase hexadecimal headers split across calls', () => {
  const payload = '0123456789abcdefghijklmnop'; // 26 bytes = 0x1a
  assert.equal(decode(['1', 'a\r', '\n' + payload + '\r\n0\r\n\r\n']), payload);
});

test('CRLF inside the payload is content, not framing', () => {
  assert.equal(decode('4\r\na\r\nb\r\n0\r\n\r\n'.split('')), 'a\r\nb');
});

test('empty calls and repeated result calls do not change progress', () => {
  const decoder = new StreamingDecoder();
  assert.equal(decoder.result(), '');
  decoder.processChunk('');
  decoder.processChunk('3\r\nH');
  assert.equal(decoder.result(), 'H');
  assert.equal(decoder.result(), 'H');
  decoder.processChunk('');
  decoder.processChunk('el\r\n0\r\n\r\n');
  assert.equal(decoder.result(), 'Hel');
});

test('empty message and split terminal delimiter', () => {
  assert.equal(decode(['0', '\r', '\n', '\r', '\n', '']), '');
});

test('malformed framing and unsafe sizes are rejected', () => {
  for (const input of [
    '\r\n', 'G\r\n', '1\rx', '1\r\naX', '1\r\na\rX',
    '0\r\nX', '0\r\n\rX', '20000000000000\r\n',
  ]) {
    const decoder = new StreamingDecoder();
    assert.throws(() => decoder.processChunk(input));
    assert.throws(() => decoder.processChunk(''), /error state/);
  }
});

test('additional data after termination is rejected, in the same or a later call', () => {
  assert.throws(() => decode(['0\r\n\r\nx']), /after the end/);
  assert.throws(() => decode(['0\r\n\r\n', 'x']), /after the end/);
});

test('non-string input is rejected', () => {
  const decoder = new StreamingDecoder();
  assert.throws(() => decoder.processChunk(null), TypeError);
});
