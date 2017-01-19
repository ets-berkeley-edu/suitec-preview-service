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

var gm = require('gm');
var path = require('path');
var util = require('util');

var PreviewConstants = require('./constants');
var Result = require('./model').Result;

/**
 * Process an image
 *
 * @param  {Context}    ctx                 The job context
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the image
 */
var process = module.exports.process = function(ctx, callback) {
  processImage(ctx, ctx.sourcePath, callback);
};

/**
 * Process a specific image
 *
 * @param  {Context}    ctx                 The job context
 * @param  {String}     file                The path to the file on disk to process
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the image
 */
var processImage = module.exports.processImage = function(ctx, file, callback) {
  generateLargeImage(ctx, file, function(err, imagePath, width) {
    if (err) {
      return callback(err);
    }

    generateThumbnail(ctx, file, function(err, thumbnailPath) {
      if (err) {
        return callback(err);
      }

      var metadata = {'image_width': width};
      var result = new Result(PreviewConstants.STATUS.DONE, thumbnailPath, imagePath, null, metadata);
      return callback(null, result);
    });
  });
};

/**
 * Generate a large image for an input file
 *
 * @param  {Context}    ctx                   The job context
 * @param  {String}     file                  The path to a file on disk for which to generate the large image
 * @param  {Function}   callback              Standard callback function
 * @param  {Object}     callback.err          An error object, if any
 * @param  {Result}     callback.imagePath    The path to the large image on disk
 * @param  {Number}     callback.width        The width of the generated image
 */
var generateLargeImage = module.exports.generateLargeImage = function(ctx, file, callback) {
  getImageSize(file, function(err, originalSize) {
    if (err) {
      return callback(err);
    }

    // Don't upscale the image if the source is smaller than the desired image width.
    // Do however run it through the `resizeImage` function as that will convert
    // the source to a jpeg
    var width = PreviewConstants.SIZES.IMAGE;
    if (originalSize.width <= PreviewConstants.SIZES.IMAGE) {
      width = originalSize.width;
    }

    // Resize the image so it fits the required with
    var resizeOptions = {'width': width};
    resizeImage(ctx, file, resizeOptions, function(err, imagePath) {
      return callback(err, imagePath, width);
    });
  });
};

/**
 * Generate a thumbnail for an input file
 *
 * @param  {Context}    ctx                       The job context
 * @param  {String}     file                      The path to a file on disk for which to generate the thumbnail
 * @param  {Function}   callback                  Standard callback function
 * @param  {Object}     callback.err              An error object, if any
 * @param  {Result}     callback.thumbnailPath    The path to the thumbnail on disk
 */
var generateThumbnail = module.exports.generateThumbnail = function(ctx, file, callback) {
  getImageSize(file, function(err, originalSize) {
    if (err) {
      return callback(err);
    }

    var thumbnailWidth = PreviewConstants.SIZES.THUMBNAILS.width;
    var thumbnailHeight = PreviewConstants.SIZES.THUMBNAILS.height;

    // We will try to crop out as much as we can but still following the input ratio. Once
    // we've cropped out a part, we'll resize it down to the desired input dimensions
    var widthRatio = originalSize.width / thumbnailWidth;
    var heightRatio = originalSize.height / thumbnailHeight;
    var ratio = (widthRatio < heightRatio) ? widthRatio : heightRatio;
    var cropWidth = Math.floor(thumbnailWidth * ratio);
    var cropHeight = Math.floor(thumbnailHeight * ratio);

    // We know now that we'll crop out a rectangle of cropWidth by cropHeight pixels. Now
    // we have to determine where we'll crop it out. Landscape images will get the middle
    // part of the image cropped out (and thus lose stuff on the side). We expect that
    // portrait images are usually documents who have the pertinent information at the top
    // of the page. Therefore we'll crop out the largest rectangle at the top.
    var cropOptions = {
      'x': 0,
      'y': 0,
      'width': cropWidth,
      'height': cropHeight
    };
    if (originalSize.width > originalSize.height) {
      cropOptions.x = Math.floor((originalSize.width - cropWidth) / 2);
      cropOptions.y = Math.floor((originalSize.height - cropHeight) / 3);
    }

    // Crop out the image that will serve as the thumbnail
    cropImage(ctx, file, cropOptions, function(err, croppedImage) {
      if (err) {
        return callback(err);
      }

      // Resize the cropped image
      var resizeOptions = {
        'width': thumbnailWidth,
        'height': thumbnailHeight
      };
      return resizeImage(ctx, croppedImage, resizeOptions, callback);
    });
  });
};

/**
 * Get the dimensions of an image
 *
 * @param  {String}     file                            The path to an image on disk
 * @param  {Function}   callback                        Standard callback function
 * @param  {Object}     callback.err                    An error object, if any
 * @param  {Object}     callback.dimensions             The dimensions of the image
 * @param  {Number}     callback.dimensions.width       The width of the image
 * @param  {Number}     callback.dimensions.height      The height of the image
 * @api private
 */
var getImageSize = function(file, callback) {
  var gmChain = gm(file);

  // GIF support
  gmChain.sourceFrames = '[0]';
  gmChain.autoOrient().identify(function(err, metadata) {
    if (err) {
      return callback({'code': 500, 'msg': err});
    }

    var originalSize = {
      'width': metadata.size.width,
      'height': metadata.size.height
    };
    return callback(null, originalSize);
  });
};

/**
 * Crop a specific area out an image
 *
 * @param  {ctx}        ctx                     The job context
 * @param  {String}     file                            The path to an image on disk
 * @param  {Object}     options                         The crop options
 * @param  {Number}     options.x                       The top-left X coordinate to start cropping from
 * @param  {Number}     options.y                       The top-left Y coordinate to start cropping from
 * @param  {Number}     options.width                   The width of the box to crop
 * @param  {Number}     options.height                  The height of the box to crop
 * @param  {Function}   callback                        Standard callback function
 * @param  {Object}     callback.err                    An error object, if any
 * @param  {String}     callback.outputFile             The path of the cropped image on disk
 * @api private
 */
var cropImage = function(ctx, file, options, callback) {
  var outputFilename = util.format('cropped_%dx%d_%d.jpg', options.width, options.height, Date.now());
  var outputFilePath = path.join(ctx.directory, outputFilename);

  gm(file)
    .autoOrient()
    .noProfile()
    .flatten()
    .background('white')
    .crop(options.width, options.height, options.x, options.y)
    .write(outputFilePath, function(err) {
      if (err) {
        return callback({'code': 500, 'msg': err.message});
      }

      return callback(null, outputFilePath);
    });
};

/**
 * Resize an image
 *
 * @param  {ctx}        ctx                     The job context
 * @param  {String}     file                    The path to an image on disk
 * @param  {Object}     options                 The resize options
 * @param  {Number}     options.width           The desired width of the resized image
 * @param  {Number}     options.height          The desired height of the resized image
 * @param  {Function}   callback                Standard callback function
 * @param  {Object}     callback.err            An error object, if any
 * @param  {String}     callback.outputFile     The path of the resized image on disk
 * @api private
 */
var resizeImage = function(ctx, file, options, callback) {
  var outputFilename = util.format('resized_%dx%d_%d.png', options.width, options.height, Date.now());
  var outputFilePath = path.join(ctx.directory, outputFilename);

  gm(file)
    .autoOrient()
    .noProfile()
    .resize(options.width, options.height)
    .write(outputFilePath, function(err) {
      if (err) {
        return callback({'code': 500, 'msg': err.message});
      }

      return callback(null, outputFilePath);
    });
};
