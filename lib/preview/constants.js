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

module.exports = {
  'STATUS': {
    'DONE': 'done',
    'ERROR': 'error',
    'UNSUPPORTED': 'unsupported'
  },
  'SIZES': {
    'THUMBNAILS': {
      'width': 300,
      'height': 300
    },
    'IMAGE': 1038
  },
  'MIMETYPES': {
    'IMAGE': [
      'application/dicom',
      'application/postscript',
      'application/tga',
      'application/x-font-ttf',
      'application/x-tga',
      'application/x-targa',
      'image/bmp',
      'image/gif',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/svg+xml',
      'image/targa',
      'image/tga',
      'image/tiff',
      'image/vnd.adobe.photoshop',
      'image/webp',
      'image/x-cmu-raster',
      'image/x-gnuplot',
      'image/x-icon',
      'image/x-ms-bmp',
      'image/x-targa',
      'image/x-tga',
      'image/x-xbitmap',
      'image/x-xpixmap',
      'image/x-xwindowdump',
      'image/xcf'
    ],
    'OFFICE': [
      'application/CDFV2-corrupt',
      'application/msword',
      'application/rdf+xml',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.12',
      'application/vnd.ms-powerpoint',
      'application/vnd.ms-powerpoint.12',
      'application/vnd.oasis.opendocument.chart',
      'application/vnd.oasis.opendocument.database',
      'application/vnd.oasis.opendocument.formula',
      'application/vnd.oasis.opendocument.graphics',
      'application/vnd.oasis.opendocument.graphics-template',
      'application/vnd.oasis.opendocument.image',
      'application/vnd.oasis.opendocument.presentation',
      'application/vnd.oasis.opendocument.presentation-template',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.spreadsheetml',
      'application/vnd.oasis.opendocument.spreadsheet-template',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.text-master',
      'application/vnd.oasis.opendocument.text-web',
      'application/vnd.openofficeorg.extension',
      'application/vnd.openxmlformats-officedocument.presentationml',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/x-mspowerpoint',
      'application/x-pdf',
      'application/x-powerpoint',
      'text/plain'
    ],
    'PDF': [ 'application/pdf' ],
    'VIDEO': [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-m4v',
      'video/x-ms-wmv',
      'video/x-msvideo'
    ]
  }
};
