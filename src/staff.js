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
 * Creates a staff
 * @class Represents a Staff
 * 
 * @param {Array} bb [ulx, uly, lrx, lry] staff bounding box
 * (.) <ulx,uly>        (.)
 *
 *
 * (.)        <lrx,lry> (.)
 *
 * @param {Object} options [numlines {Number}, lid {String}, interact {Boolean}]
 *
 * The staff has list of elements on the staff.
 * lid is the layer id since previous final division, which may be on a previous system (staff).
 * lids for subsequent final divisions within the system (staff) are stored in the Toe.Model.Division
 * object, in which instances are stored in the this.elements array.
 */
Toe.Model.Staff = function(bb, options) {
    // set position
    if(!Toe.validBoundingBox(bb)) {
        throw new Error("Staff: invalid bounding box");
    }

    this.zone = new Object();
    this.zone.ulx = bb[0];
    this.zone.uly = bb[1];
    this.zone.lrx = bb[2];
    this.zone.lry = bb[3];

    // default 4 stafflines
    this.props = {
        numLines: 4,
        interact: false
    };

    $.extend(this.props, options);

    // cache delta y: pixels between stafflines
    this.delta_y = Math.abs(this.zone.lry - this.zone.uly) / (this.props.numLines-1);

    // id of the staff
    this.id = null;

    this.custos = null;

    this.elements = new Array();
}

Toe.Model.Staff.prototype.constructor = Toe.Model.Staff;

Toe.Model.Staff.prototype.setID = function(sid) {
    this.id = sid;
}

/**
 * Sets the bounding box of the staff
 *
 * @methodOf Toe.Model.Staff
 * @param {Array} bb [ulx,uly,lrx,lry]
 */
Toe.Model.Staff.prototype.setBoundingBox = function(bb) {
    if(!Toe.validBoundingBox(bb)) {
        throw new Error("Staff: invalid bounding box");
    }
    
    bb = $.map(bb, Math.round);

    this.zone.ulx = bb[0];
    this.zone.uly = bb[1];
    this.zone.lrx = bb[2];
    this.zone.lry = bb[3];

    // update delta_y cache
    this.delta_y = Math.abs(this.zone.lry - this.zone.uly) / (this.props.numLines-1);
}

// if clef is given, return pitched elements under the given acting clef
// otherwise, return all pitched elements
Toe.Model.Staff.prototype.getPitchedElements = function(options) {
    var opts = {
        clef: null,
        neumes: true,
        custos: true
    }

    $.extend(opts, options);

    // return pitched elements under the given acting clef
    if (opts.clef) {
        var pitchedEles = new Array();
        var cInd = $.inArray(opts.clef, this.elements);
        for (var i = cInd+1; i < this.elements.length && !(this.elements[i] instanceof Toe.Model.Clef); i++) {
            var e = this.elements[i];
            if ((e instanceof Toe.Model.Neume && opts.neumes) || (e instanceof Toe.Model.Custos && opts.custos)) {
                pitchedEles.push(e);
            }
        }
        return pitchedEles;
    }
    else {
        // return all pitched elements on the staff
        return $.grep(this.elements, function(e) {
            if ((e instanceof Toe.Model.Neume && opts.neumes) || (e instanceof Toe.Model.Custos && opts.custos)) {
                return e;
            }
        });
    }
}

// calculate pitch info of pitched element on this Staff
// from its staff position.
Toe.Model.Staff.prototype.calcPitchFromStaffPos = function(staffPos, actingClef) {
    // calculate difference from clef position
    var yStep = staffPos - actingClef.props.staffPos;

    // ["a", "b", "c", "d", "e", "f", "g"]
    var numChroma = Toe.neumaticChroma.length;

    var iClef = $.inArray(actingClef.shape, Toe.neumaticChroma);
    var iPitch = (iClef + yStep) % numChroma;
    if (iPitch < 0) {
        iPitch += numChroma;
    }

    var pname = Toe.neumaticChroma[iPitch];

    // calculate octave overflow
    var cInd = $.inArray("c", Toe.neumaticChroma);
    var octOver = $.truncateFloat(yStep / numChroma);
    if (yStep > 0 && (iPitch >= cInd && iPitch < iClef)) {
        octOver++;
    }
    else if (yStep < 0 && (iPitch < cInd || iPitch > iClef)) {
        octOver--;
    }

    var clefOct = 4;
    if (actingClef.shape == "f") {
        clefOct = 3;
    }

    var oct = clefOct + octOver;

    return {pname: pname, oct: oct};
}

// Calculate staff position of note on the staff from pitch information.
// This is the inverse function of @see calcPitchFromStaffPos
Toe.Model.Staff.prototype.calcStaffPosFromPitch = function(pname, oct, actingClef) {
    var clefOct = 4;
    if (actingClef.shape == "f") {
        clefOct = 3;
    }

    // ["a", "b", "c", "d", "e", "f", "g"]
    var numChroma = Toe.neumaticChroma.length;
    
    // make root note search in relation to the clef index
    var iClef = $.inArray(actingClef.shape, Toe.neumaticChroma);
    var iPitch = $.inArray(pname, Toe.neumaticChroma);
    var cInd = $.inArray("c", Toe.neumaticChroma);

    var clefDiff = iPitch - iClef + numChroma*(oct - clefOct);
    if (iPitch < cInd) {
        clefDiff += numChroma;
    }

    var staffPos = actingClef.props.staffPos + clefDiff;
    return staffPos;
}

/**
 * Calculates note pitch name and octave from coordinates of note
 * Coords should be snapped to line/space already! @see ohSnap
 */
Toe.Model.Staff.prototype.calcPitchFromCoords = function(coords) {
    var staffPos = Math.round((this.zone.uly - coords.y) / (this.delta_y/2));

    // get acting clef
    var actingClef = this.getActingClefByCoords(coords);
    
    return this.calcPitchFromStaffPos(staffPos, actingClef);
}

// if clef given, update from this clef to the next clef
// otherwise update everything
Toe.Model.Staff.prototype.updatePitchedElements = function(options) {
    var opts = {
        clef: null,
        neumes: true,
        custos: false
    };

    $.extend(opts, options);

    var staff = this;

    // update pitched elements from the given clef to the next clef
    if (opts.clef) {
        var pitchedEles = this.getPitchedElements({clef: opts.clef});
        
        // if the custos is under the given acting clef and opts.custos is false
        // (meaning we are not to overwrite its pitch content), then we need to shift
        // the custos drawing accordingly
        if (this.custos && pitchedEles[pitchedEles.length-1] == this.custos && !opts.custos) {
            var newStaffPos = this.calcStaffPosFromPitch(this.custos.pname, this.custos.oct, opts.clef);
            this.custos.setRootStaffPos(newStaffPos);
            pitchedEles.pop();
        }

        $.each(pitchedEles, function(eInd, e) {
            staff.updateElePitchInfo(e, {clef: opts.clef});
        });
    }
    else {
        var curClef = null;
        $.each(this.elements, function(eInd, e) {
            if (e instanceof Toe.Model.Clef) {
                curClef = e;
            }
            else if (curClef && ((e instanceof Toe.Model.Neume && opts.neumes) || (e == this.custos && opts.custos))) {
                staff.updateElePitchInfo(e, {clef: curClef});
            }
            else if (this.custos && e == this.custos && !opts.custos) {
                var newStaffPos = this.calcStaffPosFromPitch(this.custos.pname, this.custos.oct, curClef);
                this.custos.setRootStaffPos(newStaffPos);
            }
        });
    }
}

// update pitch name/octave of each component of the pitched element.
Toe.Model.Staff.prototype.updateElePitchInfo = function(pitchedEle, options) {
    var opts = {
        clef: null
    };

    $.extend(opts, options);

    if (!opts.clef) {
        opts.clef = this.getActingClefByEle(pitchedEle);
    }

    var staff = this;
    if (pitchedEle instanceof Toe.Model.Neume) {
        $.each(pitchedEle.components, function(ncInd, nc) {
            var staffPos = pitchedEle.rootStaffPos + nc.pitchDiff;
            var pitchInfo = staff.calcPitchFromStaffPos(staffPos, opts.clef);

            // update the pitch information
            nc.setPitchInfo(pitchInfo["pname"], pitchInfo["oct"]);
        });
    }
    else if (pitchedEle instanceof Toe.Model.Custos) {
        var staffPos = pitchedEle.rootStaffPos;
        var pitchInfo = this.calcPitchFromStaffPos(staffPos, opts.clef);

        // update the pitch information
        pitchedEle.setRootNote(pitchInfo["pname"], pitchInfo["oct"]);
    }
}

/**
 * Calculate the pitch difference of a note with respect to the clef shape
 *
 * @methodOf Toe.Model.Staff
 * @param {string} pname neume component pname
 * @param {number} octave neume component octave
 * @return {Integer} integer pitch difference
 */
Toe.Model.Staff.prototype.calcPitchDifference = function(pname, octave, clefShape) {
    }

// sort based on ulx bounding box position
Toe.Model.Staff.prototype.sortElements = function() {
    this.elements.sort(function(el1, el2) {
        return el1.zone.ulx - el2.zone.ulx;
    });
}

// insert element in the element list (sorted in ascending order
// by x position).
Toe.Model.Staff.prototype.insertElement = function(ele) {
    // by default, we should push to the end of the array
    var iInsert = this.elements.length;
    for (var i = 0; i < this.elements.length; i++) {
        if (ele.zone.ulx <= this.elements[i].zone.ulx) {
            iInsert = i;
            break;
        }
    }

    this.elements.splice(iInsert,0, ele);

    return iInsert;
}

// Remove element by ID
Toe.Model.Staff.prototype.removeElementByID = function(eleID) {
    for (var i = this.elements.length-1; i >= 0; i--) {
        if (this.elements[i].id == eleID) {
            // remove drawing
            $(this.elements[i]).trigger("vEraseDrawing");
            this.elements.splice(i,1);
        }
    }
}

// remove element by reference
Toe.Model.Staff.prototype.removeElementByRef = function(ele) {
    var eleInd = $.inArray(ele, this.elements);

    if (eleInd >= 0) {
        // remove drawing
        $(this.elements[eleInd]).trigger("vEraseDrawing");
        this.elements.splice(eleInd, 1);
    }
}

/**
 * Get clef acting on an element
 *
 * @methodOf Toe.Model.staff
 */
Toe.Model.Staff.prototype.getActingClefByEle = function(element) {
    var eleInd = $.inArray(element, this.elements);
    // look backwards for first clef
    for (var i = eleInd; i >= 0; i--) {
        var e = this.elements[i];
        if (e instanceof Toe.Model.Clef) {
            return e;
        }
    }

    // if no clef is on the staff
    return null;
}

Toe.Model.Staff.prototype.getActingClefByCoords = function(coords) {
    // look backwards from end of element list for first clef
    for (var i = this.elements.length; i >= 0; i--) {
        var e = this.elements[i];
        if (e instanceof Toe.Model.Clef && coords.x > e.zone.lrx) {
            return e;
        }
    }

    // if no clef is on found
    return null;
}

// Given a clef mounted on this staff, get the previous acting clef
Toe.Model.Staff.prototype.getPreviousClef = function(clef) {
    var oldClefInd = $.inArray(clef, this.elements);
    // only search if the clef is not the first clef, and is mounted on this staff
    if (oldClefInd > 0) {
        for (var i = oldClefInd-1; i >= 0; i--) {
            if (this.elements[i] instanceof Toe.Model.Clef) {
                return this.elements[i];
            }
        }
    }

    return null;
}

/**
 * Mounts the clef on the staff
 *
 * @methodOf Toe.Model.Staff
 * @param {Toe.Model.Clef} clef The clef to mount
 * @returns {Toe.Model.Staff} pointer to this staff for chaining
 */
Toe.Model.Staff.prototype.addClef = function(clef, options) {
    if (!(clef instanceof Toe.Model.Clef)) {
        throw new Error("Staff: Invalid clef");
    }

    var opts = {
        justPush: false
    };

    $.extend(opts, options);

    // insert neume into list of sorted staff elements
    var nInd = null;
    if (opts.justPush) {
        this.elements.push(clef);
        nInd = this.elements.length-1;
    }
    else {
        nInd = this.insertElement(clef);
    }

    clef.setStaff(this);
    
    // update affected pitched elements on this staff
    this.updatePitchedElements({clef: clef, custos: false});
    
    // update view
    $(clef).trigger("vRenderClef", [clef]);

    return nInd;
}

Toe.Model.Staff.prototype.setCustos = function(custos) {
    if (!(custos instanceof Toe.Model.Custos)) {
        throw new Error("Staff: Invalid Custos");
    }

    var clef = this.getActingClefByCoords({x: custos.zone.ulx});
    if (clef) {
        // calculate pitch difference in relation to the clef
        custos.rootStaffPos = this.calcStaffPosFromPitch(custos.pname, custos.oct, clef);

        // custos should always be at the end
        // if a custos exists already, replace it
        if (this.elements.length > 0 && this.elements[this.elements.length-1] instanceof Toe.Model.Custos) {
            this.elements[this.elements.length-1] = custos;
        }
        else {
            this.elements.push(custos);
        }

        custos.setStaff(this);
        this.custos = custos;
        
        // update view
        $(custos).trigger("vRenderCustos", [custos]);

    }

    // return index in element list
    // custos will always be last in this list
    return this.elements.length-1;
}

/**
 * Mounts a neume on the staff
 *
 * @methodOf Toe.Model.Staff
 * @param {Toe.Model.Neume} neume The neume to mount
 * @params {Options} options {justPush: just push to the elements array (don't bother with sorted insert.
                              This option is for inserting from MEI, since elements are in order in MEI 
                              document already. Faster load times.)}
 * @return {Number} ind index of element on the staff
 */
Toe.Model.Staff.prototype.addNeume = function(neume, options) {
    // check argument is a neume
    if (!(neume instanceof Toe.Model.Neume)) {
        throw new Error("Staff: Invalid neume");
    }
    
    var opts = {
        justPush: false
    };

    $.extend(opts, options);

    var clef = this.getActingClefByCoords({x: neume.zone.ulx});
    if (clef) {
        // update neume root note difference
        var rootPitchInfo = neume.getRootPitchInfo();
        neume.rootStaffPos = this.calcStaffPosFromPitch(neume.components[0].pname, neume.components[0].oct, clef);

        // update pitch differences (wrt. root note) of each note within the neume
        neume.components[0].setPitchDifference(0);
        for (var i = 1; i < neume.components.length; i++) {
            var nc = neume.components[i];
            nc.setPitchDifference(this.calcStaffPosFromPitch(nc.pname, nc.oct, clef) - neume.rootStaffPos);
        }

        // insert neume into list of sorted staff elements
        var nInd = null;
        if (opts.justPush) {
            this.elements.push(neume);
            nInd = this.elements.length-1;
        }
        else {
            nInd = this.insertElement(neume);
        }

        neume.setStaff(this);

        // update view
        $(neume).trigger("vRenderNeume", [neume]);

        return nInd;
    }
    else {
        return null;
    }
}

/**
 * @params {Options} options {justPush: just push to the elements array (don't bother with sorted insert.
 *                              This option is for inserting from MEI, since elements are in order in MEI 
 *                              document already. Faster load times.)}
 */
Toe.Model.Staff.prototype.addDivision = function(division, options) {
	// check argument is a division
	if (!(division instanceof Toe.Model.Division)) {
		throw new Error("Staff: invalid division");
	}

    var opts = {
        justPush: false
    };

    $.extend(opts, options);

    // insert division into list of sorted staff elements
    var nInd = null;
    if (opts.justPush) {
        this.elements.push(division);
        nInd = this.elements.length-1;
    }
    else {
        nInd = this.insertElement(division);
    }

    division.setStaff(this);

    // update view
	$(division).trigger("vRenderDivision", [division]);

    return nInd;
}

/**
 * Given a set of coordinates, returns snapped coordinates
 * to lines or spaces within the staff.
 *
 * @methodOf Toe.Model.Staff
 * @param {Object} coords {x: ,y: }
 * @returns {Object} snappedCoords {x: xprime, y: yprime}
 */
Toe.Model.Staff.prototype.ohSnap = function(coords, width, options) {
    var opts = {
        ignoreEle: null,
        x: true,
        y: true
    };

    $.extend(opts, options);

    var coordsPrime = coords;

    if (opts.y) {
        // CALCULATE NEW VERTICAL POSITION
        var linesRoot = this.zone.uly;
        var spacesRoot = this.zone.uly + this.delta_y/2;

        // calculate multiple of lines or spaces
        var lineMult = (coords.y - linesRoot) / this.delta_y;
        var lineErr = Math.abs(Math.round(Math.abs(lineMult)) - Math.abs(lineMult));
        var spaceMult = (coords.y - spacesRoot) / this.delta_y;
        var spaceErr = Math.abs(Math.round(Math.abs(spaceMult)) - Math.abs(spaceMult));

        // find the minimum error for lines or spaces
        var minError = Math.min(lineErr, spaceErr);
        // there really should be an argmin in javascript ... sigh
        if (minError == lineErr) {
            // we should snap to the line!
            coordsPrime.y = linesRoot + Math.round(lineMult)*this.delta_y;
        }
        else {
            // we should snap to the space!
            coordsPrime.y = spacesRoot + Math.round(spaceMult)*this.delta_y;
        }
    }

    if (opts.x) {
        // CALCULATE NEW HORIZONTAL POSITION
        // go through each element in staff element list to see if the inserted element 
        // temporally intersects with others. If so, offset it.
        var left = coords.x-(width/2);
        var right = coords.x+(width/2);
        for (var i = 0; i < this.elements.length; i++) {
            if (this.elements[i] == opts.ignoreEle) {
                continue;
            }

            var ulx = this.elements[i].zone.ulx;
            var lrx = this.elements[i].zone.lrx;

            if (left >= lrx) {
                continue;
            }
            else {
                if ((left >= ulx && left < lrx) || (right >= ulx && right < lrx) || (ulx > left && lrx < right)) {
                    // uh oh - we've intersected a drawn element
                    var bbCentre = ulx + (lrx-ulx)/2;
                    // figure out if we should move it to the left or right
                    if (coords.x < bbCentre) {
                        // move left
                        // TODO: check that other elements aren't drawn here
                        coordsPrime.x = ulx - width/2;
                    }
                    else {
                        // move right
                        // TODO: check that other elements aren't drawn here
                        coordsPrime.x = lrx + width/2;
                    }    
                }
                else {
                    coordsPrime.x = coords.x;
                }
                break;
            }
        }

        // check left staff boundary
        if (this.elements.length && this.elements[0] instanceof Toe.Model.Clef && left <= this.elements[0].zone.lrx) {
            coordsPrime.x = this.elements[0].zone.lrx + width/2 + 1;
        }
        else if (left <= this.zone.ulx) {
            coordsPrime.x = this.zone.ulx + width/2 + 1;
        }

        // check right staff boundary
        if (this.custos && opts.ignoreEle != this.custos && right >= this.custos.zone.ulx) {
            coordsPrime.x = this.custos.zone.ulx - width/2 - 3; 
        }
        else if (right >= this.zone.lrx) {
            coordsPrime.x = this.zone.lrx - width/2 - 3;
        }
    }

    return coordsPrime;
}
