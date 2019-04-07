
var createMeteorProcess = require('./meteorProcess');
var findAvailablePort   = require('../tools').findAvailablePort;
var Promise             = require('es6-promise').Promise;
var chalk               = require('chalk');
var logs                = require('../logs');
var tools               = require('../tools');
var path                = require('path');

module.exports = function createMeteorProcessManager (options) {
  options = options || {};
  var meteorProcessPrototype = {};
  var meteorProcess          = null;
  var meteorPromise          = null;

  var pathToMain = "";
  var pathToNode = "";
  var mongoUrl   = "";


  var meteorHasCrashed = false;
  var meteorSettings   = tools.getSettings(options.settings);

  var meteorRestartDelay = 100;
  var restartRequired    = false;

  var meteorPort = null;
  var verbose    = !!options.verbose;

  meteorProcessPrototype.restart = function (delay) {

    var done = arguments[arguments.length - 1];

    if (arguments.length >= 2) {
      meteorRestartDelay = delay;
    } else {
      meteorRestartDelay = 100;
    }

    restartRequired = true;

    logs.system('restart requested');

    getMeteorProcess({

      pathToMain : pathToMain,
      pathToNode : pathToNode,
      mongoUrl   : mongoUrl,

    }).then(function () { done() }).catch(done);
  }

  function getMeteorProcess (setup) {
    // TODO: make sure the set up is fine
    if (pathToMain !== setup.pathToMain || pathToNode !== setup.pathToNode || mongoUrl !== setup.mongoUrl) {
      restartRequired = true;
    }

    pathToMain = setup.pathToMain;
    pathToNode = setup.pathToNode;
    mongoUrl   = setup.mongoUrl;

    if (!restartRequired && !!meteorPromise) {
      if (meteorHasCrashed) {
        restartRequired = true;
      }
      return meteorPromise;
    }

    restartRequired = false;

    meteorPromise = new Promise(function (resolve, reject) {

      cleanUpThen(function () {

        meteorHasCrashed = false;

        (meteorPort ? Promise.resolve(meteorPort) : findAvailablePort()).then(function (port) {

          meteorPort = port;

          var env = Object.create(process.env);

          if (meteorSettings) {
            env.METEOR_SETTINGS = JSON.stringify(meteorSettings);
          }

          env.ROOT_URL         = 'http://localhost:' + meteorPort;
          env.PORT             = meteorPort;
          env.MONGO_URL        = mongoUrl;
          env.GAGARIN_SETTINGS = "{}"; // only used if METEOR_SETTINGS does not contain gagarin field
          env.NODE_ENV         = "development";
          env.NODE_PATH        = path.join(pathToNode.split('dev_bundle')[0], 'dev_bundle', 'server-lib', 'node_modules');

          setTimeout(function () {
            meteorProcess = new createMeteorProcess(pathToNode, pathToMain, env, meteorProcessPrototype, options);
          }, meteorRestartDelay);

        }).catch(reject);

      });

      // callbacks to cooperate with meteor process

      meteorProcessPrototype.onStart = function (err) {
        if (err) {
          return reject(err);
        }
        resolve(this);
      };

      meteorProcessPrototype.onExit = function (code, lastError, lastErrorAt) {
        meteorHasCrashed = (code && code !== 0 && code !== 130);
        if (meteorHasCrashed) {
          if (lastError) {
            meteorPromise = Promise.reject(new Error(chalk.red(lastError) + chalk.blue(' => ') + chalk.blue(lastErrorAt)));
          } else {
            meteorPromise = Promise.reject(new Error(chalk.red('Meteor server has crashed due to some unknown reason.')));
          }
        }
      };

      meteorProcessPrototype.onData = function (data, opts) {
        logs.server(data, { raw: true, isError: !!opts && opts.isError });
      };

    });

    return meteorPromise;
  }

  function cleanUpThen(callback) {
    meteorPromise = null;
    //-------------------
    if (meteorProcess) {
      meteorProcess.kill(callback);
      meteorProcess = null;
    } else {
      callback();
    }
  }

  function logServerOutput(data, color) {
    if (!verbose) {
      return;
    }
    process.stdout.write(data.toString().split('\n').map(function (line) {
      if (line === '\r') {
        return;
      }
      if (line.length === 0) {
        return "";
      }
      return color('[server] ') + line;
    }).join('\n'));
  }

  return getMeteorProcess;

}
