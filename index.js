var pathos = require('pathos'),
    bytewise = require('bytewise');

module.exports = pathdb;
function pathdb(db) {
  if (db && !db.pathdb) {
    db.pathdb = {
      put: put.bind(null, db),
      get: get.bind(null, db)
    };
  }
  return db;
}

function put(db, key, value, cb) {
  if (typeof cb === 'undefined') {
    cb = value;
    value = key;
    key = [];
  }

  var paths = pathos(value);
  var batch = paths.map(function (e) {
    return {
      type: 'put',
      key: key.concat(e.key),
      value: e.value
    };
  });
  db.batch(batch, { keyEncoding: bytewise, valueEncoding: 'json' }, cb);
}

function get(db, key, cb) {
  if (typeof cb === 'undefined') {
    cb = key;
    key = [];
  }

  var result = []
  db.createReadStream({
      start: key.concat(null), end: key.concat(undefined)
    })
    .on('data', function (data) {
      result.push(data);
    })
    .on('error', function (err) {
      cb(err);
    })
    .on('end', function () {
      var obj = pathos.build(result);
      cb(null, obj);
    });
}
