var _ = require('lodash');
var util = require('../../core/util.js');
var config = util.getConfig();
var log = require(util.dirs().core + 'log');

var handle = require('./handle');
var sqliteUtil = require('./util');

var Reader = function() {
  _.bindAll(this);
  this.db = handle;
}

// returns the furtherst point (up to `from`) in time we have valid data from
Reader.prototype.mostRecentWindow = function(to, from, next) {
  var maxAmount = ((to - from) / 60) + 1;

  this.db.all(`
    SELECT start from ${sqliteUtil.table('candles')}
    WHERE start <= ${to} AND start >= ${from}
    ORDER BY start DESC
  `, function(err, rows) {
    if(err) {
      log.debug('ERROR!', err);
      return util.die('DB error while reading mostRecentWindow');
    }

    if(rows.length === 0) {
      return next(false);
    }

    if(rows.length === maxAmount) {
      return next(from);
    }

    // we have a gap
    var gapIndex = _.findIndex(rows, function(r, i) {
      return r.start !== to - i * 60;
    });

    // if no candle is recent enough
    if(gapIndex === 0) {
      return next(false);
    }

    // if there was no gap in the records, but
    // there were not enough records.
    if(gapIndex === -1)
      gapIndex = rows.length;

    next(to - gapIndex * 60);
  })
}

Reader.prototype.get = function(from, to, next) {
  this.db.all(`
    SELECT * from ${sqliteUtil.table('candles')}
    WHERE start <= ${to} AND start >= ${from}
    ORDER BY start ASC
  `, function(err, rows) {
    if(err)
      return util.die('DB error at `get`');

    next(rows);
  });
}

Reader.prototype.close = function() {
  this.db = null;
}

module.exports = Reader;