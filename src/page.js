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
 *
 * @class Represents a page of music
 */
Toe.Model.Page = function() {
    // initialize staves
    this.staves = new Array();

    // no scaling by default
    this.scale = 1.0;
}

Toe.Model.Page.prototype.constructor = Toe.Model.Page;

/**
 * Set canvas width and height directly
 *
 * @methodOf Toe.Model.Page
 * @param {Number} width Width of the page
 * @param {Number} height Height of the page
 */
Toe.Model.Page.prototype.setDimensions = function(width, height) {
    this.width = this.scale*width;
    this.height = this.scale*height;
}

/**
 * Calculate dimensions of page from bounding boxes within facsimile data in MEI file
 * 
 * (.) <ulx,uly>        (.)
 *
 *
 * (.)        <lrx,lry> (.)
 *
 * @methodOf Toe.Model.Page
 * @param {jQuery Wrapped Element Set} meiZones bounding boxes from facsimile data from an MEI document
 * @returns {Array} dimensions [width, height] of the canvas 
 */
Toe.Model.Page.prototype.calcDimensions = function(meiZones) {
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
    
	// return page properties
    return [max_x, max_y];
}

/**
 * Set the scaling factor of the page, relative to the original document.
 * Scales width and height identically to maintain aspect ratio.
 *
 * @methodOf Toe.Model.Page
 */
Toe.Model.Page.prototype.setPageScale = function(scale) {
    this.scale = scale;
}

/**
 * Given coordinates, find the index of the closest staff
 *
 * @methodOf Toe.Model.Page
 * @param {Object} coords {x: , y:}
 * @returns {Number} sInd
 */
Toe.Model.Page.prototype.getClosestStaff = function(coords) {
    var distances = $.map(this.staves, function(s) {
        // calculate distance in y-plane from centre
        var dist = Math.abs(coords.y - (s.zone.lry - (s.zone.lry - s.zone.uly)/2));
        if (coords.x < s.zone.ulx) {
            dist += s.zone.ulx - coords.x;
        }
        else if (coords.x > s.zone.lrx) {
            dist += coords.x - s.zone.lrx;
        }

        return dist;
    });

    sInd = $.inArray(Math.min.apply(Math, distances), distances);

    return this.staves[sInd];
}

/**
 * Given a staff, get the next staff on the page
 *
 * @methodOf Toe.Model.Page
 * @param {Toe.Model.Staff} staff 
 * @returns {Staff} nextStaff the next staff
 */
Toe.Model.Page.prototype.getNextStaff = function(staff) {
    var sInd = $.inArray(staff, this.staves);
    if (sInd != -1 && sInd+1 < this.staves.length) {
        return this.staves[sInd+1];
    }
    else {
        return null;
    }
}

Toe.Model.Page.prototype.getPreviousStaff = function(staff) {
    // for each staff, except the first
    var sInd = $.inArray(staff, this.staves);
    if (sInd-1 >= 0) {
        return this.staves[sInd-1];
    }
    else {
        return null;
    }
}

/**
 * Adds a given number of staves to the page
 *
 * @methodOf Toe.Model.Page
 * @param {Toe.Model.Staff} staff the staff to add to the model
 * @returns {Toe.Model.Page} pointer to the current page for chaining
 */
Toe.Model.Page.prototype.addStaff = function(staff) {
    this.staves.push(staff);

	// update view
	$(staff).trigger("vRenderStaff", [staff]);

    return this;
}
