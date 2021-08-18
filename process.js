#!/usr/bin/env node

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

var PreviewAPI = require('./lib/preview/api');

// Ensure all logging goes to the right process.log file
var Logger = require('./lib/core/logger');
Logger.setProcessContext();
var log = Logger('process');

log.debug('Started process.js');

// The only argument to this file should've been the base64-encoded JSON-stringified Context data
var data = process.argv[2];
if (!data) {
  log.debug('Missing data, exiting');
  console.error('Missing data');
  process.exit(1);
}

try {
  var ctx = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
} catch (err) {
  log.debug('Invalid data, exiting');
  console.error('Invalid data');
  process.exit(1);
}

PreviewAPI.process(ctx, function(err, result) {
  if (err) {
    log.debug('Process failure, exiting');
    console.error('Failed to process the job');
    console.error(err);
    process.exit(1);
  }

  log.debug('Success, returning result');
  var output = Buffer.from(JSON.stringify(result)).toString('base64');
  console.log(output);
  process.exit(0);
});
