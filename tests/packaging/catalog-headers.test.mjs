import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogHeaders } from './catalog-headers.mjs';

test('the catalog restricts scripts, connections, embedding and document base URLs', () => {
  for (const path of ['/', '/index.html', '/iframe.html', '/iframe.html-extra', '/nested/iframe.html', '/iframeXhtml']) {
    const policy = catalogHeaders(path)['content-security-policy'];
    assert.ok(policy, 'The catalog needs a Content-Security-Policy on ' + path);
    const directives = new Map(policy.split(';').map(part => part.trim().split(/\s+/)).map(([key, ...values]) => [key, values]));
    for (const [key, value] of Object.entries({
      'default-src': "'self'", 'connect-src': "'self'", 'frame-ancestors': path === '/iframe.html' ? "'self'" : "'none'",
      'object-src': "'none'", 'base-uri': "'self'",
    })) assert.deepEqual(directives.get(key), [value], path + ' ' + key);
    const scripts = directives.get('script-src');
    assert.ok(scripts?.includes("'self'"));
    assert.ok(scripts.every(source => source === "'self'" || /^'sha256-[A-Za-z0-9+/]{43}='$/.test(source)));
  }
});

test('the catalog disables access to the camera, microphone and location', () => {
  for (const path of ['/', '/iframe.html']) {
    const policy = catalogHeaders(path)['permissions-policy'];
    assert.ok(policy, 'The catalog needs a Permissions-Policy on ' + path);
    const entries = policy.split(',').map(entry => entry.trim());
    for (const feature of ['camera', 'microphone', 'geolocation']) assert.ok(entries.includes(feature + '=()'), feature);
  }
});
