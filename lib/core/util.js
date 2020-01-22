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
var config = require('config');
var crypto = require('crypto');
var fs = require('fs');
var log = require('../core/logger')('util');
var mmm = require('mmmagic');
var path = require('path');
var request = require('request');
var Storage = require('../core/storage');

/**
 * Download the file to disk and determine the mime type
 *
 * @param  {Context}    ctx               The preview context
 * @param  {String}     uri               The object to download
 * @param  {String}     filename          The filename to store the file contents in
 * @param  {Function}   callback          Standard callback function
 * @param  {Object}     callback.err      An error object, if any
 */
var download = module.exports.download = function(ctx, uri, filename, callback) {
  if (Storage.isS3Uri(uri)) {
    Storage.getObjectMetadata(uri, function(err, metadata) {
      if (err) {
        return callback(err);
      }

      Storage.getObject(uri, function(data) {
        return writeContentToDisk(data.createReadStream(), ctx.directory, filename, metadata.ContentType, callback);
      });
    });

  } else {
    var jar = request.jar();
    var req = request({
      'jar': jar,
      'rejectUnauthorized': false,
      'url': uri
    });

    req.on('error', function(err) {
      log.error({'ctx': ctx, 'err': err}, 'Unable to download a file');
      return callback({'code': 500, 'msg': 'Unable to download a file'});
    });

    req.on('response', function(res) {
      return writeContentToDisk(req, ctx.directory, filename, res.headers['content-type'], callback);
    });
  }
};

/**
 * Download the file to disk and determine the mime type
 *
 * @param  {Context}    stream            Stream from which we will read content
 * @param  {String}     directory         Target directory for new file
 * @param  {String}     filename          The name of file to be created
 * @param  {String}     contentType       Type of incoming content
 * @param  {Function}   callback          Standard callback function
 * @param  {Object}     callback.err      An error object, if any
 */
var writeContentToDisk = function(stream, directory, filename, contentType, callback) {
  // Construct path
  var sourcePath = path.join(directory, filename);
  var fileStream = fs.createWriteStream(sourcePath);

  // Write file to disk
  stream.pipe(fileStream);

  fileStream.on('close', function() {
    var mimeType = contentType && contentType.split(';')[0].trim();
    return callback(null, sourcePath, mimeType);
  });
};

/**
 * Get the mime type for a file
 *
 * @param  {String}     file                  The path to a file on disk
 * @param  {Function}   callback              Standard callback function
 * @param  {Object}     callback.err          An error object, if any
 * @param  {String}     callback.mimeType     The mime type for the given file
 */
var getMimeType = module.exports.getMimeType = function(file, callback) {
  var magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
  magic.detectFile(file, function(err, result) {
    if (err) {
      return callback(err);
    }

    return callback(null, result);
  });
};

/**
 * Sign a string with the configured application secret
 *
 * @param  {String}   data    The string to sign
 * @return {String}           The base64 encoded signature
 */
var sign = module.exports.sign = function(data) {
  var signKey = config.get('app.secret');
  var hmac = crypto.createHmac('sha1', signKey);
  hmac.update(data.toString());
  return hmac.digest('base64');
};
