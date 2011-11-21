/**
 * Job - AMQP plugin
 * using amqp module
 */

var util = require('util');
var amqp = require('amqp');

/**
 * Constructor
 * Receives server configuration object
 *
 * {
 *     host: 'localhost'
 *   , port: 5672
 *   , login: 'guest'
 *   , password: 'guest'
 *   , vhost: '/'
 *   , queueName: 'myqueue'
 *   , queueOption: {
 *         autoDelete: true, // boolean, default true
 *         durable:    true, // boolean, default true
 *         exclusive:  false // boolean, default false
 *     }
 *   // exchange is not implemented yet
 *   , exchangeName 'my-exchange'
 *   , exchangeOption: {
 *      type: 'topic',   // direct/fanout/topic(default)
 *      passive: false,  // boolean, default false
 *      durable: false,  // boolean, default false
 *      autoDelete: true // boolean, default true
 *   }
 * }
 *
 */

var RabbitMQ = function(){

  this.config = arguments[0] || {};

};

RabbitMQ.prototype = {
  // queue() is exposed to JobScheduler 
  queue: function(taskObj){
    // if it exists
    delete taskObj.MQ;

    var connection;
    // Default topic name
    var qname = "jobscheduler";
    if(this.config.queueName){
      qname = this.config.queueName;
    }
    // Default topic option
    var qoption = {
        autoDelete: true,
        durable: true,
        exclusive: false,
        passive: false
    };
    if(this.config.queueOption){
      qoption = this.config.queueOption;
    }

    /*
    var exname = "";
    if(this.config.exchangeName){
      console.log('yeah');
      exname = this.config.exchangeName;
    }

    var exoption = {};
    if(this.config.exchangeOption){
      exoption = this.config.exchangeOption;
    }
    */

    try {
      connection = amqp.createConnection(this.config);
    } catch (e) {
      console.error(util.inspect(e));
    }
    connection.addListener('error', function (e) {
      throw e;
    });

    //connection.on('ready', (function(config){
    connection.on('ready', function(){
      // connection.exchange('my-exchange', { type: 'topic' }); 
      // Options 
      // - type 'fanout', 'direct', or 'topic' (default) 
      // - passive (boolean) 
      // - durable (boolean) 
      // - autoDelete (boolean, default true) 

      var ex = connection.exchange();

      /*
      var ex;
      if(exoption){
        ex = connection.exchange(exname, exoption, function(){
          // if needed callback
        });
      } else {
        ex = connection.exchange();
      }
      */

      // Options
      // - passive (boolean)
      // - durable (boolean)
      // - exclusive (boolean)
      // - autoDelete (boolean, default true)
      //var queue = connection.queue(qname, { autoDelete: true, durable: true, exclusive: false }, function(){
      var queue = connection.queue(qname, qoption, function(){
        // logging here
      });

      // exchange.publish('routing.key', 'body');
      //
      // the third argument can specify additional options
      // it's not exposed for now
      // - mandatory (boolean, default false)
      // - immediate (boolean, default false)
      // - contentType (default 'application/octet-stream')
      // - contentEncoding
      // - headers
      // - deliveryMode
      // - priority (0-9)
      // - correlationId
      // - replyTo
      // - experation
      // - messageId
      // - timestamp
      // - userId
      // - appId
      // - clusterId
      ex.publish(qname, taskObj );

      // pretty ugly, but there is no way to avoid this at the moment
      setTimeout(function(){connection.end();}, 1000);
    //})(this.config));
    });
  }
};

exports.RabbitMQ = RabbitMQ;

/**
 * Worker Process constructor
 */
function RabbitMQWorker() {
    this.config = arguments[0] || {};
    this.registry = [];
}


RabbitMQWorker.prototype.addRegistry = function(file) {
    var fs = require('fs');
    rpath = fs.realpathSync(file);
    this.registry = require(rpath);
    return;
};

/**
 * for registry testing purpose
 */
RabbitMQWorker.prototype.invoke = function(str, arg){
    if(this.registry[str]) {
        this.registry[str](arg);
    } else {
        console.error('no such method');
    }
};

/**
 * RabbitMQWorker
 */
RabbitMQWorker.prototype.work = function(config){
    var dic = this.registry;
    var connection;

    // Default topic name
    var qname = "jobscheduler";
    if(this.config.queueName){
      qname = this.config.queueName;
    }
    var qoption = {
        autoDelete: true,
        durable: true,
        exclusive: false,
        passive: false
    };
    if(this.config.queueOption){
      qoption = this.config.queueOption;
    }
    try{
      connection = amqp.createConnection(this.config);
    } catch (e) {
      console.error(util.inspect(e));
    }
    connection.on('ready', function(){
        // specified queue name
        var q = connection.queue(qname, qoption);
        //q.bind('#');

        // yes
        q.subscribe(function(taskObj){
            if(dic[taskObj.taskFunc]) {
                if(taskObj.runAfter) {
                    taskObj.runAt = new Date(new Date().getTime() + taskObj.runAfter);
                }
                var timeout = new Date(taskObj.runAt) - new Date();
                this._timeoutId = setTimeout(function(self){
                  dic[taskObj.taskFunc](taskObj.taskArgObj);
                }, timeout);
            } else {
                console.error('no such method');
            }
        });
    });
};

exports.RabbitMQWorker = RabbitMQWorker;
