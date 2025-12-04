#!/usr/bin/env node

import { randomBytes } from 'crypto';

console.log('Generated secrets:\n');
console.log('Webhook Secret:');
console.log(randomBytes(32).toString('hex'));
console.log('\nSession Secret:');
console.log(randomBytes(32).toString('hex'));
console.log('\nAdd these to your .env file.');

