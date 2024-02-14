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

var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var util = require('util');

var PreviewConstants = require('./constants');
var PreviewPdf = require('./pdf');

var Logger = require('../core/logger');
Logger.setProcessContext();
var log = Logger('preview-office');

/**
 * Process an office file
 *
 * @param  {Context}    ctx                 The job context
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the office file
 */
var process = module.exports.process = function(ctx, callback) {
  var cmd = [
    // LibreOffice recquires a temporary home directory when running under the nodejs user; for more fun see
    // https://askubuntu.com/questions/678125/error-in-function-createsettingsdocument-elements-cxx-when-using-a-libreoffice
    util.format('HOME=%s', ctx.directory),
    'soffice',
    '--headless',
    '--convert-to pdf',
    util.format('--outdir "%s"', ctx.directory),
    util.format('"%s"', ctx.sourcePath)
  ].join(' ');

  log.debug(util.format('Executing command "%s"', cmd));

  exec(cmd, {'timeout': 200000}, function(err, stderr, stdout) {
    if (err) {
      log.debug('Command execution returned error');
      return callback({'code': 500, 'msg': 'Unable to generate PDF for office document'});
    }

    var pdfPath = path.join(ctx.directory, 'source.pdf');
    if (!fs.existsSync(pdfPath)) {
      log.debug(util.format('Failed to generate file at pdfPath', pdfPath));
      return callback({'code': 500, 'msg': 'A PDF file could not be generated'});
    }

    return PreviewPdf.processPdf(ctx, pdfPath, callback);
  });
};
