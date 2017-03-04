/**
 * Copyright ©2017. The Regents of the University of California (Regents). All Rights Reserved.
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
var PreviewImage = require('./image');

/**
 * Process a video file
 *
 * @param  {Context}    ctx                 The job context
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the video file
 */
var process = module.exports.process = function(ctx, callback) {
  var cmd = [
    'ffmpeg',
    util.format('-i "%s"', ctx.sourcePath),
    '-vframes 1',
    path.join(ctx.directory, 'frame%d.png')
  ].join(' ');

  exec(cmd, {'timeout': 200000}, function(err, stdout, stderr) {
    if (err) {
      return callback({'code': 500, 'msg': 'Unable to generate image from video frame'});
    }

    var imagePath = path.join(ctx.directory, 'frame1.png');
    if (!fs.existsSync(imagePath)) {
      return callback({'code': 500, 'msg': 'An image file could not be generated'});
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
      return callback({'code': 500, 'msg': 'Unable to determine video codec'});
    } else if (stdout.lastIndexOf('h264') === 0) {
      // If we're already using H264, no need to convert.
      return callback();
    }

    var convertCommand = [
      'ffmpeg',
      util.format('"%s"', ctx.sourcePath),
      '-vcodec libx264',
      'converted.mp4'
    ].join(' ');

    exec(convertCommand, {'timeout': 200000}, function(err, stdout, stderr) {
      if (err) {
        return callback({'code': 500, 'msg': 'Unable to convert video'});
      }

      var convertedVideoPath = path.join(ctx.directory, 'converted.mp4');
      if (!fs.existsSync(convertedVideoPath)) {
        return callback({'code': 500, 'msg': 'A converted video could not be generated'});
      }

      return callback(null, convertedVideoPath);
    });
  });
};
