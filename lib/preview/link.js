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

var _ = require('lodash');
var htmlparser = require('htmlparser2');
var path = require('path');
var request = require('request');
var url = require('url');
var util = require('util');
var webshot = require('webshot');

var CoreUtil = require('../core/util');

var PreviewConstants = require('./constants');
var PreviewImage = require('./image');
var Result = require('./model').Result;

// URLs matching any of these regexes will be checked for an "embedURL" meta tag.
var CHECK_EMBED_URL_REGEXES = [
  /^http(s)?:\/\/(drive|docs)\.google\.com\//
];

// URLs matching any of these regexes will be marked "not embeddable" over all protocols.
var DISALLOW_EMBED_REGEXES = [
  /^http(s)?:\/\/(www\.)?portfolium\.com\/entry/
];

var VIMEO_REGEX = /^http(s)?:\/\/(www\.)?vimeo\.com\/(\d+)$/;

var YOUTUBE_FULL_REGEX = /^http(s)?:\/\/(www\.|m\.)?youtube\.com\/watch/;
var YOUTUBE_SHORT_REGEX = /^http(s)?:\/\/youtu.be\/(.+)/;

/**
 * Process a link
 *
 * @param  {Context}    ctx                 The job context
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the link
 */
var process = module.exports.process = function(ctx, callback) {
  var link = ctx.job.url;
  var youtubeId = getYoutubeId(ctx.job.url);
  if (youtubeId) {
    return processYoutube(ctx, youtubeId, callback);
  } else if (VIMEO_REGEX.test(link)) {
    return processVimeo(ctx, link, callback);
  } else {
    return processLink(ctx, link, callback);
  }
};

// Youtube

/**
 * Get the YouTube identifier (if any) out of a link
 *
 * @param  {String}   link    The link to parse a YouTube identifier from
 * @return {String}           The YouTube identifier if the link was a YouTube link. `undefined` if the link was not a YouTube link
 * @api private
 */
var getYoutubeId = function(link) {
  var parsedUrl = url.parse(link, true);
  if (YOUTUBE_FULL_REGEX.test(link)) {
    return parsedUrl.query.v;
  } else if (YOUTUBE_SHORT_REGEX.test(link)) {
    return parsedUrl.pathname.substr(1);
  }
};

/**
 * Process a YouTube link
 *
 * @param  {Context}    ctx                 The job context
 * @param  {String}     youtubeId           The YouTube identifier
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the YouTube link
 * @api private
 */
var processYoutube = function(ctx, youtubeId, callback) {
  var previewUrl = util.format('http://img.youtube.com/vi/%s/hqdefault.jpg', youtubeId);
  CoreUtil.download(ctx, previewUrl, 'youtube_preview.jpg', function(err, previewDownloadPath, mimeType) {
    if (err) {
      return callback(err);
    } else if (mimeType !== 'image/jpeg') {
      return callback({'code': 500, 'url': previewUrl, 'msg': 'Unexpected mime type for a YouTube thumbnail image'});
    }

    PreviewImage.generateThumbnail(ctx, previewDownloadPath, function(err, thumbnailPath) {
      if (err) {
        return callback(err);
      }

      PreviewImage.generateLargeImage(ctx, previewDownloadPath, function(err, imagePath, imageWidth) {
        if (err) {
          return callback(err);
        }

        var metadata = {
          'image_width': imageWidth,
          'youtubeId': youtubeId
        };
        var result = new Result(PreviewConstants.STATUS.DONE, thumbnailPath, imagePath, null, metadata);

        return callback(null, result);
      });
    });
  });
};

// Vimeo

/**
 * Process a Vimeo link
 *
 * @param  {Context}    ctx                 The job context
 * @param  {String}     vimeoUrl            The Vimeo URL to process
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the Vimeo link
 * @api private
 */
var processVimeo = function(ctx, vimeoUrl, callback) {
  resolve(vimeoUrl, function(reachable, responses) {
    if (!reachable) {
      return callback({'code': 500, 'msg': 'Could not resolve URL ' + vimeoUrl});
    }

    // In the event of redirects, the last reponse should contain the desired body.
    var body = _.get(_.last(responses), 'body');
    if (!body) {
      return callback({'code': 500, 'msg': 'No response body for URL ' + vimeoUrl});
    }

    // We will attempt to parse the body for these values.
    var embedUrl = null;
    var imageUrl = null;
    var imageWidth = null;

    // Vimeo provides nicely structured data inside a JSON-LD tag.
    var jsonLdTag = false;
    var parseEvents = {
      'onopentag': function(name, attribs) {
        if (name === 'script' && attribs.type === 'application/ld+json') {
          jsonLdTag = true;
        }
      },
      'onclosetag': function(name) {
        if (jsonLdTag && name === 'script') {
          jsonLdTag = false;
        }
      },
      'ontext': function(text) {
        if (jsonLdTag) {
          var jsonLdData = JSON.parse(text);
          _.each(jsonLdData, function(object) {
            embedUrl = embedUrl || _.get(object, 'embedUrl');
            imageUrl = imageUrl || _.get(object, 'thumbnail.url');
            imageWidth = imageWidth || _.get(object, 'thumbnail.width');
          });
        }
      }
    };
    var parser = new htmlparser.Parser(parseEvents, {'decodeEntities': true});
    parser.write(body);
    parser.end();

    if (!imageUrl) {
      return callback({'code': 500, 'msg': 'No preview image found for Vimeo URL ' + vimeoUrl});
    }

    // Download preview image and verify MIME type.
    CoreUtil.download(ctx, imageUrl, 'image.jpg', function(err, imagePath, mimeType) {
      if (err) {
        return callback(err);
      } else if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        return callback({'code': 500, 'msg': 'Unexpected MIME type "' + mimeType + '" for preview image at Vimeo URL ' + vimeoURL});
      }

      // Generate a thumbnail of the preview image
      PreviewImage.generateThumbnail(ctx, imagePath, function(err, thumbnailPath) {
        if (err) {
          return callback(err);
        }

        var metadata = {
          'httpEmbeddable': false,
          'httpsEmbeddable': false,
          'httpEmbedUrl': null,
          'httpsEmbedUrl': null
        };

        // We expect embeddable URLs to come in over HTTPS.
        if (embedUrl && embedUrl.lastIndexOf('https') === 0) {
          metadata.httpsEmbeddable = true;
          metadata.httpsEmbedUrl = embedUrl;
        }

        if (imageWidth) {
          metadata.image_width = imageWidth;
        }

        var result = new Result(PreviewConstants.STATUS.DONE, thumbnailPath, imagePath, null, metadata);
        return callback(null, result);
      });
    });
  });
};

// Plain links

/**
 * Process a plain link
 *
 * @param  {Context}    ctx                 The job context
 * @param  {String}     link                The plain link to process
 * @param  {Function}   callback            Standard callback function
 * @param  {Object}     callback.err        An error object, if any
 * @param  {Result}     callback.result     The result for the plain link
 * @api private
 */
var processLink = function(ctx, link, callback) {
  var imagePath = path.join(ctx.directory, 'screenshot.jpg');
  var options = {
    'windowSize': {
      'width': 1280,
      'height': 1280
    },
    'phantomConfig': {
      'ssl-protocol': 'any',
      'ignore-ssl-errors': 'true',
      'web-security': 'false'
    },
    'timeout': 30000,
    'defaultWhiteBackground': true,
    'streamType': 'jpg',
    'renderDelay': 7500,
    'quality': 100
  };
  webshot(link, imagePath, options, function(err) {
    if (err) {
      return callback(err);
    }

    // Generate a thumbnail of the screenshot
    PreviewImage.generateThumbnail(ctx, imagePath, function(err, thumbnailPath) {
      if (err) {
        return callback(err);
      }

      // Check whether the link can be embedded as an iframe
      isIframeEmbeddable(link, function(err, httpEmbeddable, httpsEmbeddable, httpEmbedUrl, httpsEmbedUrl) {
        if (err) {
          return callback(err);
        }

        var metadata = {
          'httpEmbeddable': httpEmbeddable,
          'httpsEmbeddable': httpsEmbeddable,
          'httpEmbedUrl': httpEmbedUrl,
          'httpsEmbedUrl': httpsEmbedUrl,
          'image_width': 1280
        };
        var result = new Result(PreviewConstants.STATUS.DONE, thumbnailPath, imagePath, null, metadata);
        return callback(null, result);
      });
    });
  });
};

/**
 * Check whether a link can be embedded as an iframe
 *
 * @param  {String}     link                          The link to check
 * @param  {Function}   callback                      Standard callback function
 * @param  {Object}     callback.err                  An error object, if any
 * @param  {Boolean}    callback.httpEmbeddable       Whether the link is embeddable in an iframe over HTTP
 * @param  {Boolean}    callback.httpsEmbeddable      Whether the link is embeddable in an iframe over HTTPS
 * @param  {String}     [callback.httpEmbedUrl]       Alternate URL, if any, for HTTP iframe embedding
 * @param  {String}     [callback.httpsEmbedUrl]      Alternate URL, if any, for HTTPS iframe embedding
 * @api private
 */
var isIframeEmbeddable = function(link, callback) {
  var isEmbeddingDisallowed = _.find(DISALLOW_EMBED_REGEXES, function(regex) {
    return regex.test(link);
  });

  if (isEmbeddingDisallowed) {
    return callback(null, false, false);
  }

  isIframeEmbeddableOnProtocol(link, 'http', function(err, httpEmbeddable, httpEmbedUrl) {
    if (err) {
      return callback(err);
    }

    isIframeEmbeddableOnProtocol(link, 'https', function(err, httpsEmbeddable, httpsEmbedUrl) {
      if (err) {
        return callback(err);
      }

      return callback(null, httpEmbeddable, httpsEmbeddable, httpEmbedUrl, httpsEmbedUrl);
    });
  });
};

/*!
 * Check whether a link is embeddable through an iframe for a specific protocol
 *
 * @param  {String}       link                          The link to check
 * @param  {String}       protocol                      The protocol on which to embed the link. One of `http` or `https`
 * @param  {Function}     callback                      Standard callback function
 * @param  {Object}       callback.err                  An error object, if any
 * @param  {Boolean}      callback.embeddable           Whether the link is embeddable in an iframe over the specified protocol
 * @param  {String}       [callback.embedUrl]           Alternate URL, if any, for iframe embedding over the specified protocol
 * @api private
 */
var isIframeEmbeddableOnProtocol = function(link, protocol, callback) {
  // Re-jig the link so we're testing it on the desired protocol
  var expectedProtocol = util.format('%s:', protocol);
  var parsedUrl = url.parse(link);
  if (parsedUrl.protocol !== expectedProtocol) {
    parsedUrl.protocol = expectedProtocol;
  }
  link = url.format(parsedUrl);

  // Resolve the link on the desired protocol
  resolve(link, function(reachable, responses) {
    if (!reachable) {
      return callback(null, false);
    }

    var response = _.last(responses);
    if (!response) {
      return callback(null, false);
    }

    var embedUrl = null;
    var isEmbeddable = true;

    if (response.request.uri.protocol !== expectedProtocol) {
      // If the last-resolved URI has changed protocols, the link is not embeddable.
      isEmbeddable = false;

    } else if (_.has(response.headers, 'x-frame-options')) {
      // If the last-resolved response disallows framing, the link is embeddable only if an alternate embed URL is
      // provided on the expected protocol.
      embedUrl = checkEmbedUrl(response.request.uri.href, response.body, expectedProtocol);
      isEmbeddable = !!embedUrl;

    } else if (link !== response.request.uri.href) {
      // If the initial link and last-resolved link differ (i.e., redirects took place), the last-resolved link should
      // be provided as an alternate embed URL.
      embedUrl = response.request.uri.href;
    }

    return callback(null, isEmbeddable, embedUrl);
  });
};

/**
 * Parse HTML response body in search of an embedURL meta tag. Since this is potentially
 * expensive and these tags only show up in a few sources, we perform the parse only for
 * URLs matching a whitelisted regex.
 *
 * @param  {String}       url                       URL namespace determines whether we check "embedURL" meta tag.
 * @param  {String}       body                      Response body content
 * @param  {String}       expectedProtocol          Used to identify allowable "embedURL". One of `http` or `https`
 * @return {String}       embedUrl                  Alternate embeddable URL, if any
 * @api private
 */
var checkEmbedUrl = function(url, body, expectedProtocol) {
  var shouldCheckEmbedUrl = _.find(CHECK_EMBED_URL_REGEXES, function(regex) {
    return regex.test(url);
  });

  if (!shouldCheckEmbedUrl) {
    return null;
  }

  var embedUrl = null;
  var parseEvents = {
    'onopentag': function(name, attribs) {
      if (name === 'meta' && attribs.itemprop === 'embedURL' && attribs.content && attribs.content.lastIndexOf(expectedProtocol) === 0) {
        embedUrl = attribs.content;
      }
    }
  };
  var parser = new htmlparser.Parser(parseEvents, {'decodeEntities': true});
  parser.write(body);
  parser.end();

  return embedUrl;
};

/**
 * Do a GET request to the link and recursively follow any redirect links.
 * If a link redirects to an already seen link (ie: it has a redirect loop) or
 * it contains too many redirects, the link is considered to be non resolvable.
 *
 * Note that this function does not return an error. If a link could not be reached
 * for any reason, `resolvable` will be false.
 *
 * @param  {String}       link                      The link to resolve
 * @param  {Function}     callback                  Standard callback function
 * @param  {Boolean}      callback.resolvable       Whether the link can be resolved
 * @param  {Response[]}   callback.responses        Any responses that were collected along the way
 * @api private
 */
var resolve = function(link, callback, jar, responses) {
  jar = jar || request.jar();
  responses = responses || [];

  // If the link has already been checked it's definitely a redirect loop so we bail out immediately
  var seenLink = _.find(responses, function(response) {
    return (response.request.uri.href === link);
  });
  if (seenLink) {
    return callback(false, responses);

  // Don't follow more than 10 redirect links
  } else if (responses.length === 10) {
    return callback(false, responses);
  }

  var options = {
    'agent': false,
    'jar': jar,
    'url': link,
    'method': 'GET',
    'followRedirect': false,
    'strictSSL': true,
    'timeout': 5000,
    'headers': {
      // Certain webservers will not send an `x-frame-options` header when no browser user agent is specified
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36'
    }
  };
  request(options, function(err, response, body) {
    if (err) {
      // Don't pass up the error. For example, some sites aren't available over
      // https, which causes the request to time out. In that case, `false`
      // should be passed back up rather than an error object.
      return callback(false, responses);
    }

    responses.push(response);

    if (response.statusCode >= 400) {
      return callback(false, responses);
    }

    var location = response.headers.location;
    if (!location) {
      return callback(true, responses);
    }

    // Try the redirect URL and check whether its reachable
    var redirectTo = url.resolve(response.request.uri.href, location);
    resolve(redirectTo, callback, jar, responses);
  });
};
