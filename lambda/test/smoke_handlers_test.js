const path = require('path');
const handlerDir = path.join(__dirname, '..', 'handlers');
const fs = require('fs');

function listHandlerFiles() {
  return fs.readdirSync(handlerDir).filter(f => f.endsWith('.js'));
}

function loadHandler(file) {
  const p = path.join(handlerDir, file);
  try {
    const h = require(p);
    return { file, ok: true, exports: Object.keys(h) };
  } catch (err) {
    return { file, ok: false, error: err && err.message };
  }
}

function main() {
  const files = listHandlerFiles();
  console.log('Found handler files:', files.length);
  const results = files.map(loadHandler);
  results.forEach(r => {
    if (r.ok) {
      console.log(`OK  : ${r.file} -> exports: ${r.exports.join(', ')}`);
    } else {
      console.log(`ERR : ${r.file} -> ${r.error}`);
    }
  });
  // summary
  const okCount = results.filter(r => r.ok).length;
  const errCount = results.length - okCount;
  console.log(`Summary: ${okCount} OK, ${errCount} ERR`);
  if (errCount > 0) process.exitCode = 2;
}

main();

