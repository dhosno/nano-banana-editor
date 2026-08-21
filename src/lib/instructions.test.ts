import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasInstructions } from './instructions';

test('instructions can be cleared only when they contain non-whitespace text', () => {
  assert.equal(hasInstructions(''), false);
  assert.equal(hasInstructions('   \n\t'), false);
  assert.equal(hasInstructions('make the sky blue'), true);
  assert.equal(hasInstructions('  add a hat  '), true);
});
