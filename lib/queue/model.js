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

/**
 * The job model
 *
 * @param {String}    id              An id that makes sense for the caller.
 * @param {String}    url             The URL holding the data that needs to be processed. This can both be a webpage as a binary file
 * @param {String}    postBackUrl     The URL where the results should be posted back to
 */
var Job = module.exports.Job = function(id, url, postBackUrl) {
  return {
    'id': id,
    'url': url,
    'postBackUrl': postBackUrl
  };
};

/**
 * The Context model
 *
 * @param {Job}       job             The job that needs to be processed
 * @param {String}    directory       A directory on disk that can be used to store temporary files. This will be removed after the file's been processed
 * @param {String}    sourcePath      The path pointing to the source file on disk
 * @param {String}    mimeType        The detected mime type of the file
 */
var Context = module.exports.Context = function(job, directory, sourcePath, mimeType) {
  var that = {
    'job': job,
    'directory': directory,
    'sourcePath': sourcePath,
    'mimeType': mimeType
  };

  return that;
};
