/**
 * Copyright ©2016. The Regents of the University of California (Regents). All Rights Reserved.
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
var AWS = require('aws-sdk');
var config = require('config');
var exec = require('child_process').exec;
var fs = require('fs');
var request = require('request');
var tmp = require('tmp');
var util = require('util');

var CoreUtil = require('../core/util');
var log = require('../core/logger')('queue-api');
var PreviewAPI = require('../preview/api');
var PreviewConstants = require('../preview/constants');
var Result = require('../preview/model').Result;
var Storage = require('../core/storage');

var Context = require('./model').Context;
var Job = require('./model').Job;

var sqsParams = {
  'accessKeyId': config.get('aws.credentials.accessKeyId'),
  'secretAccessKey': config.get('aws.credentials.secretAccessKey'),
  'region': config.get('aws.sqs.region'),
  'apiVersion': '2012-11-05'
};
if (config.get('aws.sqs.endpoint')) {
  sqsParams.endpoint = config.get('aws.sqs.endpoint');
}
var sqs = new AWS.SQS(sqsParams);

/**
 * Initialize the SQS poller
 *
 * @param  {Function}   callback    Standard callback function
 */
var init = module.exports.init = function(callback) {
  // Start polling the SQS queue
  poll();

  return callback();
};

/**
 * Add a job on the queue
 *
 * @param  {Job}        job               The job to add
 * @param  {Function}   callback          Standard callback function
 * @param  {Object}     callback.err      An error object, if any
 */
var add = module.exports.add = function(job, callback) {
  var params = {
    'QueueUrl': config.get('aws.sqs.queueUrl'),
    'MessageBody': JSON.stringify(job)
  };
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      log.error({'err': err, 'job': job}, 'Unable to queue the job');
      return callback({'code': 500, 'msg': 'Unable to queue the job'});
    }

    log.info({'job': job}, 'Added the job to the queue');
    return callback();
  });
};

/**
 * Continuously poll the queue for messages.
 *
 * @api private
 */
var poll = function() {
  var params = {
    'QueueUrl': config.get('aws.sqs.queueUrl'),
    'WaitTimeSeconds': 20
  };
  sqs.receiveMessage(params, function(err, data) {
    if (err) {
      log.error({'err': err}, 'Got an error trying to poll the SQS queue');
      return setTimeout(poll, 20000);
    }

    if (_.isEmpty(data.Messages)) {
      return poll();
    }

    log.debug('Got %d new messages from the queue', data.Messages.length);

    // Process and delete the message
    var message = data.Messages[0];
    processMessage(message, function() {
      deleteMessage(message, function() {
        // Poll the next message
        return poll();
      });
    });
  });
};

/**
 * Delete a message from the queue
 *
 * @param  {Message}    message           The SQS message to delete from the queue
 * @param  {Function}   callback          Standard callback function
 * @param  {Object}     callback.err      An error object, if any
 * @api private
 */
var deleteMessage = function(message, callback) {
  log.debug('Deleting message');
  var params = {
    'QueueUrl': config.get('aws.sqs.queueUrl'),
    'ReceiptHandle': message.ReceiptHandle
  };
  sqs.deleteMessage(params, function(err) {
    if (err) {
      log.error({'err': err}, 'Unable to delete a message from the queue');
    }

    log.debug('Message deleted');
    return callback();
  });
};

/**
 * Process a message that was delivered on the SQS queue.
 *
 * Processing involves:
 *  - generating the appropriate thumbnail
 *  - converting to PDF or MP4 as needed
 *  - storing all results in S3
 *  - notifying the caller about the results
 *
 * Once this function completes, the message can be deleted from the queue
 *
 * @param  {Message}    message           The SQS message to process
 * @param  {Function}   callback          Standard callback function
 * @param  {Object}     callback.err      An error object, if any
 * @api private
 */
var processMessage = function(message, callback) {
  log.debug('Processing message');
  try {
    var body = JSON.parse(message.Body);
  } catch (err) {
    logger.error({'err': err}, 'Unable to parse a message on the queue');
    return callback(err);
  }
  var job = new Job(body.id, body.url, body.postBackUrl);

  // Create a temporary directory for this message that can be
  // used to store any temporary files in.
  tmp.dir({'unsafeCleanup': true}, function(err, path, cleanupCallback) {
    if (err) {
      log.error({'err': err, 'job': job}, 'Unable to create a temporary directory');
      return callback(err);
    }

    var ctx = new Context(job, path);
    processNewJob(ctx, function(err, fileResult) {
      if (err) {
        // Log an error message, but don't return as the directory
        // always needs to be removed
        log.error({'err': err, 'ctx': ctx}, 'Unable to process a job');
        fileResult = new Result(PreviewConstants.STATUS.ERROR);
      }

      log.info({'fileResult': fileResult}, 'Job output');

      // Store the thumbnail and converted files
      storeResult(ctx, fileResult, function(err, urlResult) {
        if (err) {
          urlResult = new Result(PreviewConstants.STATUS.ERROR);
        }

        // Remove the temporary directory before deleting the message
        cleanupCallback();

        // Let the caller know about the result
        postBack(ctx, urlResult);

        // The message has been completely processed, it can now be
        // removed from the queue and the next one can be processed
        log.debug({'ctx': ctx, 'result': urlResult}, 'Processed message');
        return callback();
      });
    });
  });
};

/**
 * Process a new job.
 *
 * The job gets processed in a child-process. This allows us to kill any processing
 * when it takes too long without having to do a lot of tedious cleanup.
 *
 * @param  {Context}    ctx             The job context
 * @param  {Function}   callback        Standard callback function
 * @param  {Object}     callback.err    An error object, if any
 * @api private
 */
var processNewJob = function(ctx, callback) {
  log.debug('Processing job');
  var data = new Buffer(JSON.stringify(ctx)).toString('base64');
  var cmd = util.format('node process.js %s', data);
  var options = {
    'encoding': 'utf8',
    'timeout': 200 * 60 * 1000
  };
  exec(cmd, options, function(err, stdout, stderr) {
    if (err) {
      log.error({'err': err, 'stdout': stdout, 'stderr': stderr}, 'Unable to process job');
      return callback(err);
    }

    try {
      var result = JSON.parse(new Buffer(stdout, 'base64').toString('utf8'));
    } catch (err) {
      log.error({'ctx': ctx, 'err': err}, 'Unable to parse the process script output');
      return callback({'code': 500, 'msg': 'Malformed JSON data'});
    }

    return callback(null, result);
  });
};

/**
 * Store the processing result in S3
 *
 * @param  {Context}    ctx                   The job context
 * @param  {Result}     result                The result to store
 * @param  {Function}   callback              Standard callback function
 * @param  {Object}     callback.err          An error object, if any
 * @param  {Result}     callback.urlResult    The result with the stored URLs
 * @api private
 */
var storeResult = function(ctx, result, callback) {
  // Only store something, if something was properly generated
  if (result.status !== PreviewConstants.STATUS.DONE) {
    log.warn({'ctx': ctx}, 'Not storing files as the result was not done');
    return callback(null, new Result(result.status));
  }

  storeFileIfAny(ctx, result.thumbnail, function(err, thumbnailUrl) {
    if (err) {
      return callback(err);
    }

    storeFileIfAny(ctx, result.image, function(err, imageUrl) {
      if (err) {
        return callback(err);
      }

      storeFileIfAny(ctx, result.pdf, function(err, pdfUrl) {
        if (err) {
          return callback(err);
        }

        storeFileIfAny(ctx, result.metadata.converted_video, function(err, videoUrl) {
          if (err) {
            return callback(err);
          }

          if (videoUrl) {
            result.metadata.converted_video = videoUrl;
          }

          var urlResult = new Result(result.status, thumbnailUrl, imageUrl, pdfUrl, result.metadata);
          return callback(null, urlResult);
        });
      });
    });
  });
};

/**
 * Store a file in S3, if any
 *
 * @param  {Context}    ctx               The job context
 * @param  {String}     file              The path to the file on disk that needs to be stored
 * @param  {Function}   callback          Standard callback function
 * @param  {Object}     callback.err      An error object, if any
 * @param  {Result}     callback.url      The URL to the file in S3
 * @api private
 */
var storeFileIfAny = function(ctx, file, callback) {
  if (!file) {
    return callback();
  } else if (!fs.existsSync(file)) {
    log.warn({'ctx': ctx}, 'A file was specified, but did not exist on disk');
  } else {
    Storage.store(file, callback);
  }
};

/**
 * Post the processing results back to the caller
 *
 * @param  {Context}    ctx               The job context
 * @param  {String}     urlResult         The result containing the processing status and S3 URLs
 * @api private
 */
var postBack = function(ctx, urlResult) {
  var nonce = Date.now();
  var authorizationHeader = util.format('Bearer %d:%s', nonce, CoreUtil.sign(nonce));
  var params = {
    'form': {
      'id': ctx.job.id,
      'status': urlResult.status,
      'thumbnail': urlResult.thumbnail,
      'image': urlResult.image,
      'pdf': urlResult.pdf,
      'metadata': JSON.stringify(urlResult.metadata || {})
    },
    'headers': {'Authorization': authorizationHeader}
  };
  request.post(ctx.job.postBackUrl, params, function(err, response, body) {
    if (err) {
      log.error({'ctx': ctx, 'err': err}, 'Unable to post back to the caller');
    } else if (response.statusCode !== 200) {
      log.error({'ctx': ctx, 'code': response.statusCode, 'body': body}, 'The caller rejected the post back request');
    }
  });
};
