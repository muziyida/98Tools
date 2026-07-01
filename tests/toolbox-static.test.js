const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'sehuatang-toolbox.user.js');

const main = fs.readFileSync(mainPath, 'utf8');
const batchStart = main.indexOf('function batchFavoriteOpened');
const batchEnd = main.indexOf('function setFavoriteRow', batchStart);
const batchFavorite = main.slice(batchStart, batchEnd);
const pauseStart = main.indexOf('function pauseAll');
const pauseEnd = main.indexOf('function resumeAll', pauseStart);
const pauseAll = main.slice(pauseStart, pauseEnd);
const initOpenStart = main.indexOf('function initOpenRegistry');
const initOpenEnd = main.indexOf('function clearOpenThreadRecords', initOpenStart);
const initOpenRegistry = main.slice(initOpenStart, initOpenEnd);

assert.match(
  main,
  /var hasOpenTool\s*=\s*true;/,
  'the opened-thread batch tools should be visible on every supported site page',
);

assert.match(
  main,
  /FAVORITE_CONCURRENCY:\s*parseInt\(localStorage\.getItem\('sht_favorite_concurrency'\)\s*\|\|\s*'3'/,
  'batch favorite should expose a persisted concurrency limit',
);

assert.match(
  main,
  /favoriteOpenedRunning:\s*false/,
  'batch favorite should have a running lock in STATE',
);

assert.match(
  main,
  /function getFavoriteConcurrency\(/,
  'batch favorite should clamp and read the concurrency setting through a helper',
);

assert.match(
  batchFavorite,
  /function worker\(/,
  'batch favorite should use a bounded worker queue',
);

assert.doesNotMatch(
  batchFavorite,
  /function next\(i\)/,
  'batch favorite should not use the old serial next(i) loop',
);

assert.match(
  main,
  /运行中/,
  'batch favorite progress should show running task count',
);

assert.doesNotMatch(
  main,
  /AUTO_REPLY_COOLDOWN|AUTO_REPLY_MAX_PER_SESSION|sht_reply_cooldown|sht_reply_max/,
  'auto reply should not expose or enforce cooldown/session limits',
);

assert.doesNotMatch(
  main,
  /回复冷却|回复上限|两次自动回复|最多自动回复/,
  'auto reply settings should only keep the enable switch',
);

assert.doesNotMatch(
  main,
  /sessionCount|lastReplyTime/,
  'auto reply state should not track cooldown or session count',
);

assert.match(
  main,
  /OPEN_STALE_MS:\s*30\s*\*\s*60\s*\*\s*1000/,
  'opened thread records should not expire during normal background tab throttling',
);

assert.match(
  main,
  /var _openRegistryTimers\s*=\s*\[\];/,
  'opened thread heartbeats should use timers separate from pausable page work',
);

assert.match(
  initOpenRegistry,
  /_openRegistryTimers\.push\(setInterval\(registerCurrentThread/,
  'thread tabs should keep registering while backgrounded',
);

assert.doesNotMatch(
  pauseAll,
  /_openRegistryTimers|registerCurrentThread|OPEN_REGISTRY/,
  'visibility pause should not stop opened-thread registry heartbeats',
);

console.log('toolbox static checks passed');
