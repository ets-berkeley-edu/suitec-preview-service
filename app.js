#!/usr/bin/env node

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

var AWS = require('aws-sdk');
var config = require('config');

var log = require('./lib/core/logger')('app');
var QueueAPI = require('./lib/queue/api');
var RestAPI = require('./lib/rest/api');

// All unexpected or uncaught errors will be caught and logged here. At this point we cannot
// guarantee that the system is functioning properly anymore so we kill the process. When running
// in production, the service script will automatically respawn the instance
process.on('uncaughtException', function(err) {
  log.error({'err': err}, 'Uncaught exception was raised, restarting the process');
  process.exit(1);
});

// Start listening for messages
QueueAPI.init(function(err) {
  if (err) {
    log.error({'err': err}, 'Unable to start listening for messages on the queue, restarting the process');
    process.exit(1);
  }
});

// Spin up the REST API
RestAPI.init(function(err) {
  if (err) {
    log.error({'err': err}, 'Unable to spin up the rest API, restarting the process');
    process.exit(1);
  }
});
