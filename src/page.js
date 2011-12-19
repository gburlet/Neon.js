/*
Copyright (C) 2011 by Gregory Burlet, Alastair Porter

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/**
 * Creates a new page
 * @requires Toe
 * @class Represents a page of music
 * @param {jQuery Wrapped Element Set} meiZones bounding boxes from facsimile data from an MEI document
 */
Toe.Page = function() {
	this.width = undefined;
	this.height = undefined;

	// initialize staves
	this.staves = new Array();
}

Toe.Page.prototype.constructor = Toe.Page;

/**
 * Set canvas width and height
 *
 * @param {Number} width Width of the page
 * @param {Number} height Height of the page
 * @property {Number} width Width of the canvas 
 * @property {Number} height Height of the canvas
 */

Toe.Page.prototype.setDimensions = function(width, height) {
	this.width = width;
	this.height = height;
}

/**
 * Calculate dimensions of page from bounding boxes within facsimile data in MEI file
 * 
 * (.) <ulx,uly>		(.)
 *
 *
 * (.) 		  <lrx,lry> (.)
 *
 * @param {jQuery Wrapped Element Set} meiZones bounding boxes from facsimile data from an MEI document
 * @property {Number} width Width of the canvas 
 * @property {Number} height Height of the canvas
 */
Toe.Page.prototype.calcDimensions = function(meiZones) {
	var max_x = 0;
	var max_y = 0;

	$(meiZones).each(function(it, el) {
		var lrx = parseInt($(el).attr("lrx"));
		var lry = parseInt($(el).attr("lry"));
		if (lrx > max_x) {
			max_x = lrx;
		}
		if (lry > max_y) {
			max_y = lry;
		}
	});
	
	// set page properties
	this.width = max_x;
	this.height = max_y;
}
