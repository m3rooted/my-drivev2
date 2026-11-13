const assert = require('node:assert/strict');
const { test } = require('node:test');
const { escapeHtml } = require('../services/mailer');

test('escapes user-controlled text before including it in reminder HTML', () => {
  assert.equal(escapeHtml(`<script src="x">Tom & 'Ada'</script>`), '&lt;script src=&quot;x&quot;&gt;Tom &amp; &#39;Ada&#39;&lt;/script&gt;');
});
