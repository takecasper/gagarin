
var vm = Npm.require('vm');
var Fiber = Npm.require('fibers');
var Future = Npm.require('fibers/future');

var chai, plugins = {};

if (Gagarin.isActive) {

  chai = Npm.require('chai');

  chai.should();
  chai.use(Npm.require('chai-things'));
  chai.use(Npm.require('chai-spies'));

  global.chai   = chai;
  global.Fiber  = Fiber;
  global.expect = chai.expect;
  global.spy    = chai.spy;

  // TODO: also protect these methods with some authentication (user/password/token?)
  //       note that required data my be provided with GAGARIN_SETTINGS
  Meteor.methods({

    '/gagarin/execute': function (code, args) {
      args = args || [];

      check(code, String);
      check(args, Array);
      let runMe = undefined;

      try {

        var babelOptions = Package['babel-compiler'].Babel.getDefaultOptions();
        babelOptions.sourceMap = true;
        babelOptions.ast = false;
        babelOptions.retainLines = true;

        code = "var funcToRun = " + code + "; funcToRun";
        code = Package['babel-compiler'].Babel.compile(code, babelOptions) //Package.ecmascript.ECMAScript.compileForShell(code);
        code = eval(code.code);
        runMe = function(){ return eval(code).apply(null, arguments); };

      } catch (error) {
        // console.log("execute error:", error)
        return {error: error.message}
      }

      // This allows modules to be loaded in the global context like in the shell-server, like above
      // https://github.com/meteor/meteor/blob/4aeb453c7b0a0a9556a11ea1928e63ab11302ef4/packages/shell-server/shell-server.js#L426
      function setRequireAndModule(context) {
        if (Package.modules) {
          // Use the same `require` function and `module` object visible to the
          // application.
          var toBeInstalled = {};
          var shellModuleName = "meteor-shell-" +
            Math.random().toString(36).slice(2) + ".js";

          toBeInstalled[shellModuleName] = function (require, exports, module) {
            context.module = module;
            context.require = require;

            // Tab completion sometimes uses require.extensions, but only for
            // the keys.
            require.extensions = {
              ".js": true,
              ".json": true,
              ".node": true,
            };
          };

          // This populates repl.context.{module,require} by evaluating the
          // module defined above.
          Package.modules.meteorInstall(toBeInstalled)("./" + shellModuleName);
        }
      }
      setRequireAndModule(global);

      try {
        var result = runMe.apply(null, args);
        return {value: result};
      } catch (error) {
        // console.log("execute error:", error)
        return {error: error.message, errorName: error.name, errorMessage: error.message, errorStack: error.stack, code: code}
      }
    },
    '/gagarin/promise': function (code, args) {
      args = args || [];
      var future = new Future();

      check(code, String);
      check(args, Array);

      try {
        var ready = function (feedback) {
          if (feedback.error && typeof feedback.error === 'object') {
            feedback.error = feedback.error.message;
          }
          future.return(feedback);
        };

        // reject
        args.unshift(_.once(function (error) { setTimeout(function () { ready({ error: error }); }); }));
        // resolve
        args.unshift(_.once(function (value) { setTimeout(function () { ready({ value: value }); }); }));


        // This allows modules to be loaded in the global context like in the shell-server, like above
        // https://github.com/meteor/meteor/blob/4aeb453c7b0a0a9556a11ea1928e63ab11302ef4/packages/shell-server/shell-server.js#L426
        function setRequireAndModule(context) {
          if (Package.modules) {
            // Use the same `require` function and `module` object visible to the
            // application.
            var toBeInstalled = {};
            var shellModuleName = "meteor-shell-" +
              Math.random().toString(36).slice(2) + ".js";

            toBeInstalled[shellModuleName] = function (require, exports, module) {
              context.module = module;
              context.require = require;

              // Tab completion sometimes uses require.extensions, but only for
              // the keys.
              require.extensions = {
                ".js": true,
                ".json": true,
                ".node": true,
              };
            };

            // This populates repl.context.{module,require} by evaluating the
            // module defined above.
            Package.modules.meteorInstall(toBeInstalled)("./" + shellModuleName);
          }
        }
        setRequireAndModule(global);



        var babelOptions = Package['babel-compiler'].Babel.getDefaultOptions();
        babelOptions.sourceMap = true;
        babelOptions.ast = false;
        babelOptions.retainLines = true;

        code = "var funcToRun = " + code + "; funcToRun";
        code = Package['babel-compiler'].Babel.compile(code, babelOptions) //Package.ecmascript.ECMAScript.compileForShell(code);
        code = eval(code.code);

        code.apply(null, args); // resolved by future
      } catch (error) {
        // console.log("promise error:", error)
        future.throw(error)
        return { error: error.message };
      }

      return future.wait();
    },

    '/gagarin/wait': function (timeout, message, code, args) {
      var future  = new Future();
      var timeoutId = null;
      var intervalId = null;
      args = args || [];

      check(timeout, Number);
      check(message, String);
      check(code, String);
      check(args, Array);

      try {
        var ready = function (feedback) {
          Meteor.clearTimeout(timeoutId);
          Meteor.clearInterval(intervalId);
          if (feedback.error && typeof feedback.error === 'object') {
            feedback.error = feedback.error.message;
          }
          future.return(feedback);
        }

        // This allows modules to be loaded in the global context like in the shell-server, like above
        // https://github.com/meteor/meteor/blob/4aeb453c7b0a0a9556a11ea1928e63ab11302ef4/packages/shell-server/shell-server.js#L426
        function setRequireAndModule(context) {
          if (Package.modules) {
            // Use the same `require` function and `module` object visible to the
            // application.
            var toBeInstalled = {};
            var shellModuleName = "meteor-shell-" +
              Math.random().toString(36).slice(2) + ".js";

            toBeInstalled[shellModuleName] = function (require, exports, module) {
              context.module = module;
              context.require = require;

              // Tab completion sometimes uses require.extensions, but only for
              // the keys.
              require.extensions = {
                ".js": true,
                ".json": true,
                ".node": true,
              };
            };

            // This populates repl.context.{module,require} by evaluating the
            // module defined above.
            Package.modules.meteorInstall(toBeInstalled)("./" + shellModuleName);
          }
        }
        setRequireAndModule(global);


        var babelOptions = Package['babel-compiler'].Babel.getDefaultOptions();
        babelOptions.sourceMap = true;
        babelOptions.ast = false;
        babelOptions.retainLines = true;

        code = "var funcToRun = " + code + "; funcToRun";
        code = Package['babel-compiler'].Babel.compile(code, babelOptions) //Package.ecmascript.ECMAScript.compileForShell(code);
        code = eval(code.code);

        timeoutId = Meteor.setTimeout(function () {
          Meteor.clearInterval(intervalId);
          ready({error: 'I have been waiting for ' + timeout + ' ms ' + message + ', but it did not happen.' })
        }, timeout);

        intervalId = Meteor.setInterval(function () {
          try {
            var result = code.apply(null, args);
            if ( result ) {
              Meteor.clearTimeout(timeoutId);
              Meteor.clearInterval(intervalId);
              ready({value: result});
            }
          } catch (error) {
            // console.log("wait error:", error)
            ready({error: error});
          }
        }, 50);
      } catch (error) {
        // console.log("wait error:", error)
        ready({error: error});
      }

      return future.wait();
    },

  });

  function notifyWeAreReady () {
    console.log("Gagarin: Ready! Tests may engage!");
  }

  if (WebApp.onListening) {
    WebApp.onListening(notifyWeAreReady);
  } else {
    Meteor.startup(notifyWeAreReady);
  }

}
