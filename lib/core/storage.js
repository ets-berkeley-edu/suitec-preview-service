/**
 * Copyright ©2024. The Regents of the University of California (Regents). All Rights Reserved.
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
var fs = require('fs');
var path = require('path');
var shortid = require('shortid');
var util = require('util');

var CoreUtil = require('./util');
var log = require('../core/logger')('core-storage');

var s3Params = {
  'accessKeyId': config.get('aws.credentials.accessKeyId'),
  'secretAccessKey': config.get('aws.credentials.secretAccessKey'),
  'region': config.get('aws.s3.region'),
  'apiVersion': '2006-03-01'
};

if (config.get('aws.s3.endpoint')) {
  s3Params.endpoint = config.get('aws.s3.endpoint');
}

var s3 = new AWS.S3(s3Params);

/**
 * Store a file in Amazon S3
 *
 * @param  {String}     file                The path to a file on disk to store
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {String}     callback.url        The HTTP URL where the file can be downloaded from
 */
var store = module.exports.store = function(file, callback) {
  CoreUtil.getMimeType(file, function(err, mimeType) {
    if (err) {
      return callback(null, err);
    }

    // Generate a unique prefix for the S3 key
    var d = new Date();
    var randomId = shortid.generate();
    var filename = path.basename(file);
    var key = util.format('%d/%d/%d/%d/%d/%s/%s',
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      randomId,
      filename
    );

    var putParams = {
      'Bucket': config.get('aws.s3.bucket'),
      'Body': fs.createReadStream(file),
      'CacheControl': 'max-age=232000000',
      'ContentType': mimeType,
      'Expires': new Date(2026, 1, 1),
      'Key': key
    };
    s3.putObject(putParams, function(err) {
      if (err) {
        log.error({'err': err}, 'Unable to store a file in S3');
        return callback(err);
      }

      // Generate a signed download URL
      var expires = 2 * 365 * 24 * 60 * 60;
      var signParams = {
        'Bucket': config.get('aws.s3.bucket'),
        'Expires': expires,
        'Key': key
      };
      return s3.getSignedUrl('getObject', signParams, function(err, url) {
        if (err) {
          log.error({'err': err}, 'Unable to generate a signed URL for a stored file');
          return callback({'code': 500, 'msg': 'Unable to generate a signed URL for a stored file'});
        }

        return callback(null, url);
      });
    });
  });
};

/**
 * @param  {String}     uri         S3 address or other
 * @return {Boolean}                True URI matches s3://my-bucket/my-object-key
 */
var isS3Uri = module.exports.isS3Uri = function(uri) {
  return _.startsWith(uri, 's3://');
};

/**
 * Get object from Amazon S3
 *
 * @param  {String}     s3Uri                       URI of object in S3 (e.g., s3://my-bucket/my-object-key)
 * @param  {Function}   callback                    Standard callback function
 * @param  {Object}     callback.data               Data returned from Amazon S3
 * @return {Object}                                 Callback return
 */
var getObject = module.exports.getObject = function(s3Uri, callback) {
  var params = getS3Params(s3Uri);

  return callback(s3.getObject(params));
};

/**
 * Get object metadata from Amazon S3
 *
 * @param  {String}     s3Uri                       URI of object in S3 (e.g., s3://my-bucket/my-object-key)
 * @param  {Function}   callback                    Standard callback function
 * @param  {Object}     callback.err                An error object, if any
 * @param  {Object}     callback.data               Metadata returned from Amazon S3
 */
var getObjectMetadata = module.exports.getObjectMetadata = function(s3Uri, callback) {
  s3.headObject(getS3Params(s3Uri), function(err, metadata) {
    if (err) {
      return callback(err);
    }

    return callback(null, metadata);
  });
};

/**
 * @param  {String}     s3Uri          URI of object in S3 (e.g., s3://my-bucket/my-object-key)
 * @return {Object}                    Query parameters as needed by AWS S3 module
 */
var getS3Params = function(s3Uri) {
  var uriFragments = s3Uri.split('/');

  return {
    'Bucket': uriFragments[2],
    'Key': uriFragments.slice(3).join('/')
  };
};
