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
 * Creates a neume
 * Each neume has: name, root pitch, list of neume elements, each element has difference from root pitch (int)
 *                 modifier (liquescence etc.) - alt, shift, ctrl, ctrl+shift
 * @class Neume
 * @param {Object} options key {string}, type {Toe.Model.Neume.Type}, rootNote.pitch {string}, 
 *                 rootNote.octave {number}, modifier {Toe.Model.Neume.Modifier}, interact {Boolean}
 */
Toe.Model.Neume = function(options) {
    // initialize bounding box
    this.zone = new Object();

    this.props = {
        modifier: null,
        interact: true
    };

    $.extend(this.props, options);

    // check neume modifier is known
    this.props.modifier = Toe.Model.Neume.Modifier[this.props.modifier];
    if (this.props.modifier == undefined) {
        this.props.modifier = null;
    }

    // name of the neume
    this.name = null;
    // type id - from search tree
    this.typeid = null;
    // if compound neume, the name of the neume prefix to draw
    this.neumePrefix = null;

    // staff position of the root note of the neume
    // this is set when the neume is mounted onto a staff
    this.rootStaffPos = null;

    // neume ID (generated by server (or from MEI), so null by default)
    this.id = null;

    // reference to the staff this neume is mounted on
    this.staff = null;

    // initialize neume component array
    this.components = new Array();
}

Toe.Model.Neume.prototype.constructor = Toe.Model.Neume;

/**
 * Types of neume variants: alt, shift, ctrl and ctrl_shift are the keyboard
 * shortcuts used in the Medieval Finale plugin for selection neume variants.
 * The major variant 'liquescence' occurs when the user holds down alt while 'neumifying'
 *
 * @constant
 * @public
 * @fieldOf Toe.Model.Neume
 */
Toe.Model.Neume.Modifier = {
    alt: "liquescence",
    shift: "variant 2",
    ctrl: "variant 3",
    ctrl_shift: "variant 4"
}

// Load neume search tree from json so the tree doesn't need to be populated on load
Toe.Model.Neume.SearchTree = new SearchTree();
Toe.Model.Neume.SearchTree.populateFromJSON('{"rootNode":{"payload":{"typeid":"punctum","name":"Punctum"},"children":{"0":{"payload":{"typeid":"distropha","name":"Distropha"},"children":{"0":{"payload":{"typeid":"tristropha","name":"Tristropha"},"children":{},"numChildren":0}},"numChildren":1},"1":{"payload":{"typeid":"podatus","name":"Podatus"},"children":{"1":{"payload":{"typeid":"scandicus.1","name":"Scandicus"},"children":{"1":{"payload":{"typeid":"scandicus.2","name":"Scandicus"},"children":{"1":{"payload":{"typeid":"scandicus.3","name":"Scandicus"},"children":{"1":{"payload":{"typeid":"scandicus.4","name":"Scandicus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"scandicus.flexus.3","name":"Scandicus Flexus"},"children":{},"numChildren":0}},"numChildren":2},"-1":{"payload":{"typeid":"scandicus.flexus.2","name":"Scandicus Flexus"},"children":{},"numChildren":0}},"numChildren":2},"-1":{"payload":{"typeid":"scandicus.flexus.1","name":"Scandicus Flexus"},"children":{"-1":{"payload":{"typeid":"scandicus.subpunctis.1","name":"Scandicus Subpunctis"},"children":{"-1":{"payload":{"typeid":"scandicus.subpunctis.2","name":"Scandicus Subpunctis"},"children":{},"numChildren":0}},"numChildren":1}},"numChildren":1}},"numChildren":2},"-1":{"payload":{"typeid":"torculus","name":"Torculus"},"children":{"1":{"payload":{"typeid":"torculus.resupinus.1","name":"Torculus Resupinus"},"children":{"-1":{"payload":{"typeid":"torculus.resupinus.2","name":"Torculus Resupinus"},"children":{"-1":{"payload":{"typeid":"torculus.resupinus.3","name":"Torculus Resupinus"},"children":{"-1":{"payload":{"typeid":"torculus.resupinus.4","name":"Torculus Resupinus"},"children":{},"numChildren":0}},"numChildren":1}},"numChildren":1}},"numChildren":1},"-1":{"payload":{"typeid":"podatus.subpunctis.1","name":"Podatus Subpunctis"},"children":{"1":{"payload":{"typeid":"podatus.subpunctis.resupinus.1","name":"Podatus Subpunctis Resupinus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"podatus.subpunctis.2","name":"Podatus Subpunctis"},"children":{"1":{"payload":{"typeid":"podatus.subpunctis.resupinus.2","name":"Podatus Subpunctis Resupinus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"podatus.subpunctis.3","name":"Podatus Subpunctis"},"children":{"1":{"payload":{"typeid":"podatus.subpunctis.resupinus.3","name":"Podatus Subpunctis Resupinus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"podatus.subpunctis.4","name":"Podatus Subpunctis"},"children":{},"numChildren":0}},"numChildren":2}},"numChildren":2}},"numChildren":2}},"numChildren":2}},"numChildren":2},"-1":{"payload":{"typeid":"clivis","name":"Clivis"},"children":{"1":{"payload":{"typeid":"porrectus","name":"Porrectus"},"children":{"1":{"payload":{"typeid":"compound.2","name":"Compound Neume 2"},"children":{"-1":{"payload":{"typeid":"compound.1","name":"Compound"},"children":{},"numChildren":0}},"numChildren":1},"-1":{"payload":{"typeid":"porrectus.flexus","name":"Porrectus Flexus"},"children":{"-1":{"payload":{"typeid":"porrectus.subpunctis.1","name":"Porrectus Subpunctis"},"children":{"1":{"payload":{"typeid":"porrectus.subpunctis.resupinus.1","name":"Porrectus Subpunctis Resupinus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"porrectus.subpunctis.2","name":"Porrectus Subpunctis"},"children":{"1":{"payload":{"typeid":"porrectus.subpunctis.resupinus.2","name":"Porrectus Subpunctis Resupinus"},"children":{},"numChildren":0}},"numChildren":1}},"numChildren":2}},"numChildren":1}},"numChildren":2},"-1":{"payload":{"typeid":"climacus.1","name":"Climacus"},"children":{"1":{"payload":{"typeid":"climacus.resupinus.1","name":"Climacus Resupinus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"climacus.2","name":"Climacus"},"children":{"1":{"payload":{"typeid":"climacus.resupinus.2","name":"Climacus Resupinus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"climacus.3","name":"Climacus"},"children":{"1":{"payload":{"typeid":"climacus.resupinus.3","name":"Climacus Resupinus"},"children":{},"numChildren":0},"-1":{"payload":{"typeid":"climacus.4","name":"Climacus"},"children":{"1":{"payload":{"typeid":"climacus.resupinus.4","name":"Climacus Resupinus"},"children":{},"numChildren":0}},"numChildren":1}},"numChildren":2}},"numChildren":2}},"numChildren":2}},"numChildren":2}},"numChildren":3},"numNodes":1}');

/**
 * Sets the id of the neume
 *
 * @methodOf Toe.Model.Neume
 * @ param {String} nid neume id
 */
Toe.Model.Neume.prototype.setID = function(nid) {
    this.id = nid;
}

Toe.Model.Neume.prototype.setStaff = function(staff) {
    if (!(staff instanceof Toe.Model.Staff)) {
        throw new Error("Neume: invalid staff reference");
    }

    this.staff = staff;
}

/**
 * Sets the bounding box of the neume
 *
 * @methodOf Toe.Model.Neume
 * @param {Array} bb [ulx, uly, lrx, lry]
 */
Toe.Model.Neume.prototype.setBoundingBox = function(bb) {
    if(!Toe.validBoundingBox(bb)) {
        throw new Error("Neume: invalid bounding box");
    }

    bb = $.map(bb, Math.round);

    // set position
    this.zone.ulx = bb[0];
    this.zone.uly = bb[1];
    this.zone.lrx = bb[2];
    this.zone.lry = bb[3];
}

// get the root pitch name and octave
Toe.Model.Neume.prototype.getRootPitchInfo = function() {
    var pname = null;
    var oct = null;

    if (this.components.length > 0) {
        pname = this.components[0].pname;
        oct = this.components[0].oct;
    }

    return {pname: pname, oct: oct};
}

// get the pitch name and octave of all neume notes
Toe.Model.Neume.prototype.getPitchInfo = function() {
    var pitchInfo = new Array();

    $.each(this.components, function(ncInd, nc) {
        pitchInfo.push({pname: nc.pname, oct: nc.oct});
    });

    return pitchInfo;
}

/**
 * Sets the staff position of the root note
 */
Toe.Model.Neume.prototype.setRootStaffPos = function(staffPos) {
    if (this.rootStaffPos == staffPos) {
        return;
    }

    this.rootStaffPos = staffPos;

    var actingClef = this.staff.getActingClefByEle(this);
    var pitchInfo = this.staff.calcPitchFromStaffPos(this.rootStaffPos, actingClef);
    var neume = this;
    $.each(this.components, function(ncInd, nc) {
        var staffPos = neume.rootStaffPos + nc.pitchDiff;
        var pitchInfo = neume.staff.calcPitchFromStaffPos(staffPos, actingClef);

        // update the pitch information
        nc.setPitchInfo(pitchInfo["pname"], pitchInfo["oct"]);
    });

    this.syncDrawing();
}

/**
 * Fills the neume with data from an MEI neume element
 *
 * @methodOf Toe.Model.Neume
 * @param {jQuery wrapped element set} neumeData the MEI neume data
 * @param {jQuery wrapped element set} facs the MEI facs data for the provided neume
 */
Toe.Model.Neume.prototype.neumeFromMei = function(neumeData, bb) {
    // check the DOM element is in fact a neume
    if (neumeData.nodeName.toLowerCase() != "neume") {
        throw new Error("neumeFromMei: invalid neume data");
    }

    this.id = $(neumeData).attr("xml:id");
    var nName = $(neumeData).attr("name").toLowerCase();
    // perform neume -> neume & modifier transformations
    // For example, in the current MEI neumes module, cephalicus and epiphonus are their
    // own neumes. In the Medieval Finale plugin they are clivis and podatus neumes, respectively,
    // with an alt (liquescence) modifier.
    if (nName == "epiphonus") {
        nName = "podatus";
        this.props.modifier = Toe.Model.Neume.Modifier["alt"];
    }
    else if (nName == "cephalicus") {
        nName = "clivis";
        this.props.modifier = Toe.Model.Neume.Modifier["alt"];
    }
    
    this.setBoundingBox(bb);

    // cache a local copy of this so the handle isn't overidden within the jquery function
    var theNeume = this;
    $(neumeData).find("note").each(function(it, el) {
        var pname = $(el).attr("pname");
        var oct = parseInt($(el).attr("oct"));

        var ncType = "punctum";
        if ($(this).parent().attr("inclinatum") == "true") {
            if ($(this).parent().attr("deminutus") == "true") {
                ncType = "punctum_inclinatum_parvum";
            }
            else {
                ncType = "punctum_inclinatum";
            }
        }
        else if ($(this).parent().attr("quilisma") == "true") {
            ncType = "quilisma";
        }
        else if (nName == "virga" || nName == "bivirga" || nName == "trivirga") {
            ncType = "virga";
        }
        else if (nName == "cavum") {
            ncType = "cavum";
        }

        // add note ornaments
        var ornaments = new Array();

        // check for dot
        var dotForm = $("> dot", this).attr("form");
        if (dotForm) {
            ornaments.push(new Toe.Model.Ornament("dot", {form: dotForm}));
        }

        theNeume.addComponent(ncType, pname, oct, {ornaments: ornaments});
    });

    // for chaining
    return this;
}

/**
 * Adds a neume component to the neume
 * nInd is index 0 based
 *
 * @methodOf Toe.Model.Neume
 * @param {string} Neume component type
 * @diff {number} pitch difference from the root
 * @options {Object} options neumeInd {number} index of where to insert the component in the neume
 */
Toe.Model.Neume.prototype.addComponent = function(type, pname, oct, options) {
    opts = {
        ncInd: this.components.length,
        ornaments: []
    };

    $.extend(opts, options);

    var nc = new Toe.Model.NeumeComponent(pname, oct, {type: type, ornaments: opts.ornaments});

    this.components.splice(opts.ncInd, 0, nc);
}

/**
 * Gets the pitch differences for each component. Ignore the first component since
 * the first pitch difference is always 0 (since it is the root note)
 *
 * @methodOf Toe.Model.Neume
 * @returns {Array} array of pitch differences for each neume component
 */
Toe.Model.Neume.prototype.getDifferences = function() {
    var diffs = new Array();
    for(var i = 1; i < this.components.length; i++) {
        diffs.push(this.components[i].pitchDiff);
    }
    return diffs;
}

/**
 * Converts neume component difference integers to basic up/downs in the form of
 * 1 and -1, for up and down, respectively.
 *
 * @methodOf Toe.Model.Neume
 * @returns {Array} melodic movement in ups and downs
 */
Toe.Model.Neume.prototype.diffToMelodicMove = function() {
    var diffs = this.getDifferences();

    // convert to ups and downs
    var prevDiff = 0;
    diffs = $.map(diffs, function(x, i) {
        var relation = 0;
        if (x > prevDiff) {
            relation = 1;
        }
        else if (x < prevDiff) {
            relation = -1;
        }
        
        prevDiff = x;
        return relation;
    });

    return diffs;
}

/**
 * Derives the name of the neume using the pitch differences
 * and sets the name on the model.
 * 
 * @methodOf Toe.Model.Neume
 * @returns {string} neume name
 */
Toe.Model.Neume.prototype.deriveName = function(options) {
    var opts = {
        enforceHeadShapes: true
    };

    $.extend(opts, options);

    // checks
    if (this.components.length == 0) {
        return "unknown";
    }

    var diffs = this.diffToMelodicMove();

    // search the tree for the neume name
    var res = Toe.Model.Neume.SearchTree.search(diffs, true);

    if (res.prefix) {
        this.neumePrefix = res.result.typeid;
        this.name = "Compound";
        this.typeid = "compound";
    }
    else {
        this.neumePrefix = null;
        this.name = res.result.name;
        this.typeid = res.result.typeid;
    }

    // situations where name is modified
    // VIRGA: punctum with different head shape
    // CAVUM: punctum with different head shape
    // EPIPHONUS: podatus with liquescence modifier
    // CEPHALICUS: clivis with liquescence modifier
    // SCANDICUS: scandicus continued
    if (this.typeid == "punctum" && this.components[0].props.type == "virga") {
        this.name = "Virga";
        this.typeid = "virga";
    }
    else if (this.typeid == "distropha" && this.components[0].props.type == "virga") {
        this.name = "Bivirga";
        this.typeid = "bivirga";
    }
    else if (this.typeid == "tristropha" && this.components[0].props.type == "virga") {
        this.name = "Trivirga";
        this.typeid = "trivirga";
    }
    else if (this.name == "Punctum" && this.components[0].props.type == "cavum") {
        this.name = "Cavum";
        this.typeid = "cavum";
    }
    else if (this.name == "Podatus" && this.props.modifier == Toe.Model.Neume.Modifier["alt"]) {
        this.name = "Epiphonus";
        this.typeid = "epiphonus";
    }
    else if (this.name == "Clivis" && this.props.modifier == Toe.Model.Neume.Modifier["alt"]) {
        this.name = "Cephalicus";
        this.typeid = "cephalicus";
    }

    if (opts.enforceHeadShapes) {
        this.enforceHeadShapes();
    }

    return this.name;
}

/**
 * Change head shapes of neume components in the model which are changed
 * when neume type changes.
 */
Toe.Model.Neume.prototype.enforceHeadShapes = function() {
    switch (this.typeid) {
        case "climacus.1":
        case "climacus.2":
        case "climacus.3":
        case "climacus.4":
            for (var i = 1; i < this.components.length; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
        case "climacus.resupinus.1":
        case "climacus.resupinus.2":
        case "climacus.resupinus.3":
        case "climacus.resupinus.4":
            for (var i = 1; i < this.components.length-1; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
        case "podatus.subpunctis.1":
        case "podatus.subpunctis.2":
        case "podatus.subpunctis.3":
        case "podatus.subpunctis.4":
            for (var i = 2; i < this.components.length; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
        case "podatus.subpunctis.resupinus.1":
        case "podatus.subpunctis.resupinus.2":
        case "podatus.subpunctis.resupinus.3":
            for (var i = 2; i < this.components.length-1; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
        case "scandicus.subpunctis.1":
        case "scandicus.subpunctis.2":
            for (var i = 3; i < this.components.length; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
        case "porrectus.subpunctis.1":
        case "porrectus.subpunctis.2":
            for (var i = 3; i < this.components.length; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
        case "porrectus.subpunctis.resupinus.1":
        case "porrectus.subpunctis.resupinus.2":
            for (var i = 3; i < this.components.length-1; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
        case "torculus.resupinus.3":
        case "torculus.resupinus.4":
            for (var i = 4; i < this.components.length; i++) {
                this.components[i].setHeadShape("punctum_inclinatum");
            }
            break;
    }
}

/**
 * Synchronize drawing with the current state of the model.
 * Should be called when underlying note content has changed 
 * or ornamentation has been added to individual notes.
 */
Toe.Model.Neume.prototype.syncDrawing = function() {
    this.deriveName();

    $(this).trigger("vUpdateDrawing", [this]);
}
