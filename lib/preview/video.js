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

var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var util = require('util');

var log = require('../core/logger')('preview-video');

var PreviewConstants = require('./constants');
var PreviewImage = require('./image');
var Result = require('./model').Result;

/**
 * Process a video file
 *
 * @param  {Context}    ctx                 The job context
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the video file
 */
var process = module.exports.process = function(ctx, callback) {
  extractMiddleFrame(ctx, function(err, imagePath) {
    if (err) {
      return callback(err);
    }

    PreviewImage.processImage(ctx, imagePath, function(err, imageResult) {
      if (err) {
        return callback(err);
      }

      convertVideoIfNecessary(ctx, function(err, convertedVideoPath) {
        if (err) {
          return callback(err);
        }

        if (convertedVideoPath) {
          imageResult.metadata.converted_video = convertedVideoPath;
        }
        var result = new Result(PreviewConstants.STATUS.DONE, imageResult.thumbnail, imageResult.image, null, imageResult.metadata);

        return callback(null, result);
      });
    });
  });
};

/**
 * Extract the (approximately) middle frame as a PNG image
 *
 * @param  {Context}    ctx                          The job context
 * @param  {Function}   callback                     Standard callback function
 * @param  {Object}     callback.err                 An error object, if any
 * @param  {String}     callback.imagePath           The path to the extracted image
 */
var extractMiddleFrame = function(ctx, callback) {
  var getDurationCommand = [
    'ffprobe',
    '-v error',
    '-select_streams v:0',
    '-show_entries stream=duration',
    '-of default=noprint_wrappers=1:nokey=1',
    util.format('"%s"', ctx.sourcePath)
  ].join(' ');

  exec(getDurationCommand, {'timeout': 30000}, function(err, stdout, stderr) {
    var timecode = 0;
    if (err) {
      log.error({'err': err, 'path': ctx.sourcePath}, 'Error getting video duration, will attempt to use first frame');
    } else {
      var duration = Number(stdout);
      if (Number.isNaN(duration)) {
        log.error({'duration': stdout, 'path': ctx.sourcePath}, 'Got non-numeric value for video duration, will attempt to use first frame');
      } else {
        timecode = duration / 2;
      }
    }

    var extractCommand = [
      'ffmpeg',
      util.format('-i "%s"', ctx.sourcePath),
      '-vframes 1',
      util.format('-ss %d', timecode),
      path.join(ctx.directory, 'frame%d.png')
    ].join(' ');

    exec(extractCommand, {'timeout': 200000}, function(err, stdout, stderr) {
      if (err) {
        var msg = util.format('Error while extracting image from video: %s', err.message);
        return callback({'code': 500, 'msg': msg});
      }

      var imagePath = path.join(ctx.directory, 'frame1.png');
      if (!fs.existsSync(imagePath)) {
        var msg = util.format('An image file could not be generated at %s', imagePath);
        return callback({'code': 500, 'msg': msg});
      }

      return callback(null, imagePath);
    });
  });
};

/**
 * If necessary, convert a video to the H264 codec so that it will play nicely in HTML5 video elements
 *
 * @param  {Context}    ctx                          The job context
 * @param  {Function}   callback                     Standard callback function
 * @param  {Object}     callback.err                 An error object, if any
 * @param  {String}     callback.convertedVideoPath  The path to the converted video, if one was generated
 */
var convertVideoIfNecessary = function(ctx, callback) {
  var checkCodecCommand = [
    'ffprobe',
    '-v error',
    '-select_streams v:0',
    '-show_entries stream=codec_name',
    '-of default=noprint_wrappers=1:nokey=1',
    util.format('"%s"', ctx.sourcePath)
  ].join(' ');

  exec(checkCodecCommand, {'timeout': 30000}, function(err, stdout, stderr) {
    if (err) {
      var msg = util.format('Error while determining codec for video: %s', err.message);
      return callback({'code': 500, 'msg': msg});
    } else if (stdout.lastIndexOf('h264') === 0) {
      // If we're already using H264, no need to convert.
      return callback();
    }

    var convertedVideoPath = path.join(ctx.directory, 'converted.mp4');
    var convertCommand = [
      'ffmpeg',
      util.format('-i "%s"', ctx.sourcePath),
      '-vcodec libx264',
      convertedVideoPath
    ].join(' ');

    exec(convertCommand, {'timeout': 200000}, function(err, stdout, stderr) {
      if (err) {
        var msg = util.format('Error while converting video: %s', err.message);
        return callback({'code': 500, 'msg': msg});
      }

      if (!fs.existsSync(convertedVideoPath)) {
        var msg = util.format('A converted video could not be generated at %s', convertedVideoPath);
        return callback({'code': 500, 'msg': msg});
      }

      return callback(null, convertedVideoPath);
    });
  });
};
