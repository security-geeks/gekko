var _ = require('lodash');
var util = require('../util');
var config = util.getConfig();
var dirs = util.dirs();
var log = require(dirs.core + 'log');
var moment = require('moment');

var adapter = config.adapters[config.importer.adapter];
var daterange = config.importer.daterange;

var TradeBatcher = require(dirs.budfox + 'tradeBatcher');
var CandleManager = require(dirs.budfox + 'candleManager');
var exchangeChecker = require(dirs.core + 'exchangeChecker');

var error = exchangeChecker.cantFetchFullHistory(config.watch);
if(error)
  util.die(error, true);

var fetcher = require(dirs.importers + config.watch.exchange);

if(!daterange.to) {
  var now = moment();
  daterange.to = now;
  log.debug(
    'No end date specified for importing, setting to',
    now.format('YYYY-MM-DD HH:mm:ss')
  );
}

if(daterange.to <= daterange.from)
  util.die('This daterange does not make sense.')

var Market = function() {
  _.bindAll(this);
  this.exchangeSettings = exchangeChecker.settings(config.watch);

  this.tradeBatcher = new TradeBatcher(this.exchangeSettings.tid);
  this.candleManager = new CandleManager;
  this.fetcher = fetcher(daterange);

  this.done = false;

  this.fetcher.bus.on(
    'trades',
    this.processTrades
  );

  this.fetcher.bus.on(
    'done',
    function() {
      this.done = true;
    }.bind(this)
  )

  this.tradeBatcher.on(
    'new batch',
    this.candleManager.processTrades
  );

  this.candleManager.on(
    'candles',
    this.pushCandles
  );  

  Readable.call(this, {objectMode: true});

  this.get();
}

var Readable = require('stream').Readable;
Market.prototype = Object.create(Readable.prototype, {
  constructor: { value: Market }
});

Market.prototype._read = _.noop;

Market.prototype.pushCandles = function(candles) {
  _.each(candles, this.push);
}

Market.prototype.get = function() {
  this.fetcher.fetch();
}

Market.prototype.processTrades = function(trades) {
  this.tradeBatcher.write(trades);

  if(this.done)
    return log.info('Done importing!');

  setTimeout(this.get, 1000);
}

module.exports = Market;