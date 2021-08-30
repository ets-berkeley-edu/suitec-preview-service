/**
 * Copyright ©2020. The Regents of the University of California (Regents). All Rights Reserved.
 *
 * Permission to use, copy, modify, and distribute this software and its documentation
 * for educational, research, and not-for-profit purposes, without fee and without a
 * signed licensing agreement, is hereby granted, provided that the above copyright
 * notice, this paragraph and the following two paragraphs appear in all copies,
 * modifications, and distributions.
 *
 * Contact The Office of Technology Licensing, UC Berkeley, 2150 Shattuck Avenue,
 * Suite 510, Berkeley, CA 94720-1620, (510) 643-7201, otl@berkeley.edu,
 * http://ipira.berkeley.edu/industry-info for commercial licensing opportunities.
 *
 * IN NO EVENT SHALL REGENTS BE LIABLE TO ANY PARTY FOR DIRECT, INDIRECT, SPECIAL,
 * INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, ARISING OUT OF
 * THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN IF REGENTS HAS BEEN ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * REGENTS SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE
 * SOFTWARE AND ACCOMPANYING DOCUMENTATION, IF ANY, PROVIDED HEREUNDER IS PROVIDED
 * "AS IS". REGENTS HAS NO OBLIGATION TO PROVIDE MAINTENANCE, SUPPORT, UPDATES,
 * ENHANCEMENTS, OR MODIFICATIONS.
 */

var _ = require('lodash');
var bodyParser = require('body-parser');
var config = require('config');
var express = require('express');
var fs = require('fs');
var http = require('http');
var path = require('path');
var util = require('util');

var appPackage = require('../../package.json');
var CoreUtil = require('../core/util');
var Job = require('../queue/model').Job;
var log = require('../core/logger')('rest-api');
var QueueAPI = require('../queue/api');

/**
 * Initializes the REST API.
 *
 * @param  {Function}     callback          Standard callback function
 * @param  {Object}       callback.err      An error object, if any
 */
var init = module.exports.init = function(callback) {
  // Create the express server
  var app = express();

  // Expose the HTTP server on the express app to allow other modules to hook into it
  app.httpServer = http.createServer(app);

  // Start listening for requests
  var port = config.get('app.port');
  app.httpServer.listen(port, 'localhost');

  // Don't output pretty JSON
  app.set('json spaces', 0);

  // Don't output the x-powered-by header
  app.set('x-powered-by', false);

  // Indicate that Collabosphere is being used behind a reverse proxy
  // @see http://expressjs.com/guide/behind-proxies.html
  app.enable('trust proxy');

  // Parse URLEncoded POST requests. We're only interested
  // in basic string values, so extended can be set to `false`.
  app.use(bodyParser.urlencoded({'extended': false}));

  // Expose unauthenticated endpoints
  setupUnauthenticatedRoutes(app);

  // Ensure all subsequent routes are authenticated
  setupAuthentication(app);

  // Catch-all error handler
  app.use(function(err, req, res, next) {
    log.error({
      'err': err,
      'req': req,
      'res': res
    }, 'Unhandled error in the request chain, caught at the default error handler');
    return abort(res, 500, 'An unexpected error occurred');
  });

  log.info(util.format('The REST API is listening at http://127.0.0.1:%s', port));

  // Expose the necessary endpoints
  setupRoutes(app);

  return callback();
};

/**
 * Set up status API routes requiring no authentication
 *
 * @param  {Object}   app   The ExpressJS application
 * @api private
 */
var setupUnauthenticatedRoutes = function(app) {
  app.get('/', function(req, res) {
    var status = {'app': true};
    return res.status(200).send(status);
  });

  app.get('/api/status', function(req, res) {
    var status = {'app': true};
    return res.status(200).send(status);
  });

  app.get('/api/version', function(req, res) {
    var version = {'version': appPackage.version};
    // Add build info, if available
    var buildStats = '../../config/build-stats.json';
    if (fs.existsSync(path.join(__dirname, buildStats))) {
      _.extend(version, require(buildStats));
    }
    return res.status(200).send(version);
  });
};

/**
 * Sets up the REST routes
 *
 * @param  {Object}   app   The ExpressJS application
 * @api private
 */
var setupRoutes = function(app) {
  app.post('/process', function(req, res) {
    // A process request needs three pieces of information:
    //  - Some unique ID for the job
    //  - A URL that needs to be processed. This can be a URL to an
    //    image or a URL to a webpage
    //  - A URL where the results can be posted back to
    var id = req.body.id;
    var url = req.body.url;
    var postBackUrl = req.body.postBackUrl;
    if (!id || !url || !postBackUrl) {
      return res.status(400).send('Missing parameters. `id`, `url` and `postBackUrl` are required.');
    }

    // Stick the job on the queue
    var job = new Job(id, url, postBackUrl);
    QueueAPI.add(job, function(err) {
      if (err) {
        return res.status(err.code).send(err.msg);
      }

      return res.status(200).send(job);
    });
  });
};

/**
 * Sets up simple authentication middleware.
 *
 * All requests should be authenticated using a shared secret that needs to be passed
 * in the `Authorization` header of each request.
 *
 * @param  {Object}   app     The expressjs app
 * @api private
 */
var setupAuthentication = function(app) {
  app.use(function(req, res, next) {
    if (!req.headers.authorization) {
      log.warn({
        'method': req.method,
        'host': req.headers.host,
        'referer': req.headers.referer,
        'targetPath': req.path
      }, 'Missing authorization token');
      return abort(res, 401, 'Unauthenticated request');
    } else if (req.headers.authorization.substring(0, 7) !== 'Bearer ') {
      log.warn({
        'method': req.method,
        'host': req.headers.host,
        'referer': req.headers.referer,
        'targetPath': req.path
      }, 'Invalid authorization scheme');
      return abort(res, 401, 'Unauthenticated request');
    }

    var tokens = req.headers.authorization.substring(7).split(':');
    if (tokens.length !== 2) {
      log.warn({
        'method': req.method,
        'host': req.headers.host,
        'referer': req.headers.referer,
        'targetPath': req.path
      }, 'Invalid authorization token');
      return abort(res, 401, 'Unauthenticated request');
    }

    var nonce = tokens[0];
    var signature = tokens[1];
    if (CoreUtil.sign(nonce) !== signature) {
      log.warn({
        'method': req.method,
        'host': req.headers.host,
        'referer': req.headers.referer,
        'targetPath': req.path
      }, 'Incorrect authorization token');
      return abort(res, 401, 'Unauthenticated request');
    }

    return next();
  });
};

/**
 * Abort a request with a given code and response message
 *
 * @param  {Response}   res         The express response object
 * @param  {Number}     code        The HTTP response code
 * @param  {String}     message     The message body to provide as a reason for aborting the request
 * @api private
 */
var abort = function(res, code, message) {
  res.setHeader('Connection', 'Close');
  return res.status(code).send(message);
};
