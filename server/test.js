// Tests the server code against a stand-in for Google Script Properties: node server/test.js
const fs = require('fs');
const store = {};
global.PropertiesService = { getScriptProperties: () => ({
  getProperties: () => ({ ...store }), setProperties: o => Object.assign(store, o), deleteProperty: k => { delete store[k]; } }) };
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
global.ContentService = global.HtmlService = global.UrlFetchApp = {};
const run = file => { const f = new Function(fs.readFileSync(file, 'utf8') + '; return handle;'); return f(); };
const handle = run(process.argv[2] || require('path').join(__dirname, 'Code.gs'));
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
// existing accounts, as on the live server
handle({ op: 'newuser', num: '1254', name: 'Achachan 1254', av: 'man' });
handle({ op: 'newuser', num: '2030', name: 'Beenanty', av: 'woman' });
handle({ op: 'save', num: '2030', pin: '2030', state: { contacts: [1] } });
ok(handle({ op: 'load', num: '1988', pin: '1988' }).ok, 'built-in account still signs in');
let r = handle({ op: 'edituser', num: '1254', pin: '1254', name: 'Achachan', av: 'grandpa' });
ok(r.ok && r.name === 'Achachan' && r.av === 'grandpa', 'edit added account: new name and grandpa picture');
r = handle({ op: 'edituser', num: '1988', pin: '1988', name: 'Suraj S', av: 'man' });
ok(r.ok && r.name === 'Suraj S', 'edit built-in account name');
let ppl = handle({ op: 'people' }).people;
ok(ppl.find(p => p.num === '1254').av === 'grandpa' && ppl.find(p => p.num === '1988').name === 'Suraj S', 'people list shows the edits');
ok(handle({ op: 'load', num: '1988', pin: '1988' }).name === 'Suraj S', 'renamed built-in account still signs in with its number');
ok(handle({ op: 'load', num: '2030', pin: '2030' }).dir['1988'] === 'Suraj S', 'others see the new name in their directory');
r = handle({ op: 'newuser', num: '3333', name: 'Ammachi', av: 'grandma' });
ok(r.ok && r.av === 'grandma', 'new account with grandma picture');
ok(handle({ op: 'edituser', num: '1254', pin: '9999', name: 'X', av: 'man' }).error === 'login', 'edit with wrong PIN refused');
ok(handle({ op: 'deluser', num: '1988', pin: '1988' }).error === 'built in', 'built-in account cannot be removed');
ok(handle({ op: 'deluser', num: '2030', pin: '2030' }).ok, 'remove added account');
ok(!handle({ op: 'people' }).people.some(p => p.num === '2030') && !Object.keys(store).some(k => k.includes('_2030')), 'removed account and its data are gone');
ok(handle({ op: 'load', num: '2030', pin: '2030' }).error === 'login', 'removed account can no longer sign in');
for (let i = 0; i < 20; i++) handle({ op: 'newuser', num: String(5000 + i), name: 'Test ' + i, av: 'boy' });
ok(handle({ op: 'people' }).people.length >= 25, 'more than 12 added accounts allowed');
ok(handle({ op: 'newuser', num: '6000', name: 'A<b>"c', av: 'alien' }).av === 'man' && handle({ op: 'people' }).people.find(p => p.num === '6000').name === 'Abc', 'odd names cleaned, unknown pictures become man');
