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
var fs = require('fs');
var path = require('path');
var request = require('request');

var Context = require('../queue/model').Context;
var CoreUtil = require('../core/util');
var log = require('../core/logger')('preview-api');

var PreviewConstants = require('./constants');
var PreviewImage = require('./image');
var PreviewLink = require('./link');
var PreviewOffice = require('./office');
var PreviewPdf = require('./pdf');
var PreviewVideo = require('./video');
var Result = require('./model').Result;

/**
 * Process a file
 *
 * @param  {Context}    ctx                 The job context
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object if any
 * @param  {Result}     callback.result     The result for the job
 */
var process = module.exports.process = function(ctx, callback) {
  // Download the input source
  CoreUtil.download(ctx, ctx.job.url, 'source', function(err, sourcePath, mimeType) {
    if (err) {
      return callback(err);
    }

    // The file has been downloaded and the mime type has been determined.
    // It can now be processed appropriately.
    var newCtx = new Context(ctx.job, ctx.directory, sourcePath, mimeType);
    return processSource(newCtx, callback);
  });
};

/**
 * Process a job.
 *
 * The remote file should have been downloaded and the mime type needs to be available on
 * the context
 *
 * @param  {Context}    ctx                 The job context
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object if any
 * @param  {Result}     callback.result     The result for the job
 * @api private
 */
var processSource = function(ctx, callback) {
  if (_.indexOf(PreviewConstants.MIMETYPES.IMAGE, ctx.mimeType) !== -1) {
    return PreviewImage.process(ctx, callback);
  } else if (_.indexOf(PreviewConstants.MIMETYPES.OFFICE, ctx.mimeType) !== -1) {
    return PreviewOffice.process(ctx, callback);
  } else if (_.indexOf(PreviewConstants.MIMETYPES.PDF, ctx.mimeType) !== -1) {
    return PreviewPdf.process(ctx, callback);
  } else if (_.indexOf(PreviewConstants.MIMETYPES.VIDEO, ctx.mimeType) !== -1) {
    return PreviewVideo.process(ctx, callback);
  } else if (ctx.mimeType === 'text/html') {
    return PreviewLink.process(ctx, callback);
  } else {
    return callback(null, new Result(PreviewConstants.STATUS.UNSUPPORTED));
  }
};
