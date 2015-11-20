/*global self*/
import Promise from './promise';

import {
  isArray
} from './utils';

import {
  asap 
} from './asap';


export default function polyfill() {
  var local;

  if (typeof global !== 'undefined') {
      local = global;
  } else if (typeof self !== 'undefined') {
      local = self;
  } else {
      try {
          local = Function('return this')();
      } catch (e) {
          throw new Error('polyfill failed because global object is unavailable in this environment');
      }
  }

  var P = local.Promise;
  console.dir(P);

  if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
    return;
  } else if (P && P.toString().indexOf('[native code]') !== -1) {

    var wrapThennable = function (thennable) {
      return new P(function (resolve, reject) {
        try {
          var then = thennable.then;
        } catch (e) {
          resolve = function () {};
          asap(function () {
            reject(e);
          });
        }
        asap(function () {
          if (typeof then !== 'function') {
            resolve(then);
            return;
          }
          try {
            then.call(thennable, resolve, reject);
          } catch (e) {
            resolve = function () {};
            asap(function () {
              reject(e);
            });
          }
        });
      });
    };

    var isNonPromiseThennable = function (thing) {
      var isPromise = thing instanceof local.Promise;
      var isThennable = thing && typeof thing === 'object' && 'then' in thing;
      
      if (!isPromise && isThennable) {
        return true;
      }
      return false;
    };

    local.Promise = function Promise (resolver) {

      if (this instanceof local.Promise === false) {
        throw new TypeError('Must use new.');
      }

      if (typeof resolver !== 'function') {
        throw new TypeError('Resolver must be a function.');
      }

      var resolveCalled = false;
      var rejectCalled = false;
      var promiseCalled = false;
      var promiseResolve;
      var promiseReject;
      var resolutionOrReason;

      var outerResolve = function (resolution) {
        if (resolveCalled || rejectCalled) {
          return;
        }
        if (resolution === internalPromise) {
          outerReject(new TypeError('You cannot resolve a promise with itself'));
          return;
        }
        if (isNonPromiseThennable(resolution)) {
          try {
            resolution = wrapThennable(resolution);
          } catch (e) {
            outerReject(e);
            return;
          }
        }
        if (promiseResolve) {
          try {
            promiseResolve(resolution);
          } catch (e) {
            promiseReject(e);
          }
          return;
        }
        resolveCalled = true;
        resolutionOrReason = resolution;
      };
      var outerReject = function (reason) {
        if (resolveCalled || rejectCalled) {
          return;
        }
        rejectCalled = true;
        if (promiseReject) {
          promiseReject(reason);
          return;
        }
        resolutionOrReason = reason;
      };

      try {
        resolver(outerResolve, outerReject);
      } catch (e) {
        return new P(function (resolve, reject) {
          asap(function () {
            reject(e);
          });
        });
        //outerReject(e);
      }

      var internalPromise = new P(function (resolve, reject) {
        if (rejectCalled) {
          reject(resolutionOrReason);
        }
        promiseReject = reject;
        if (resolveCalled) {
          resolve(resolutionOrReason);
        }
        promiseResolve = resolve;
      });

      return internalPromise;
    };

    local.Promise.accept = P.accept;
    local.Promise.accept = P.accept;
    local.Promise.defer = P.defer;
    local.Promise.reject = P.reject;


    var proto = local.Promise.prototype;

    var originalAll = P.all;
    local.Promise.all = function (promises) {
      if (!isArray(promises)) {
        return P.reject(new TypeError('All must be passed an array'));
      }
      try {
        promises = promises.map(function (thing) {
          if (isNonPromiseThennable(thing)) {
            return wrapThennable(thing);
          }
          return thing;
        });
        return originalAll.call(local.Promise, promises);
      } catch (e) {
        return local.Promise.reject(e);
      }
    };

    local.Promise.race = function (promises) {
      if (!isArray(promises)) {
        return local.Promise.reject(new TypeError('You must pass an array to race.'));
      }
      var notDone = {};
      var results = promises.map(function () { return notDone; });
      promises.forEach(function (promise, i) {
        try {
          promise.then(function (result) {
            results[i] = result;
          });
        } catch (e) {
          results[i] = promise;
        }
      });
      return P.race(promises).then(function () {
        for (var i = 0; i < results.length; i++) {
          if (results[i] !== notDone) {
            return results[i];
          }
        }
      });
    };
    
    proto.then = function (onFulfilled, onRejected) {
      if (typeof onFulfilled !== 'function') {
        onFulfilled = undefined;
      }
      if (typeof onRejected !== 'function') {
        onRejected = undefined;
      }
      return new local.Promise(function (resolve, reject) {
        this._internalPromise.then(function (result) {
          if (isNonPromiseThennable(result)) {
            result = wrapThennable(result);
          }
          asap(function () {
            if (onFulfilled) {
              try {
                resolve(onFulfilled(result));
              } catch (e) {
                reject(e);
              }
            }
          });
        }, onRejected);
      }.bind(this));
    };

    var originalCatch = local.Promise.prototype['catch'];
    proto['catch'] = function (onRejected) {
      if (typeof onRejected !== 'function') {
        onRejected = undefined;
      }
      return this._internalPromise['catch'](onRejected);
    };

    local.Promise.resolve = function (thing) {
      try {
        if (isNonPromiseThennable(thing)) {
          return P.resolve(wrapThennable(Promise.resolve(thing)));
        }
      } catch (e) {
        return local.Promise.reject(e);
      }
      return P.resolve(thing);
    };

    return;
  }

  local.Promise = Promise;
}
