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
 * Manages the GUI creation and interactions
 *
 * @class GUI handling
 * @param {Object} guiToggles Boolean values toggling instantiation of GUI elements
 */
Toe.View.GUI = function(prefix, fileName, rendEng, page, guiToggles) {
    var toggles = {
        sldr_bgImgOpacity: true,
        initBgImgOpacity: 0.60,
        initMode: "edit"
    };

    $.extend(toggles, guiToggles);

    this.rendEng = rendEng;
    this.page = page;
    this.prefix = prefix;
    this.fileName = fileName;

    // these are variables holding pointers to the drawings
    // that follow around the pointer in insert mode.
    this.punctDwg = null;
    this.divisionDwg = null;

    // cache height and width of punctum glyph for use in
    // bounding box estimation in neumify and ungroup
    // and insert ornamentation spacing.
    var punctGlyph = rendEng.getGlyph("punctum").clone();
    this.punctWidth = punctGlyph.width*rendEng.getGlobalScale();
    this.punctHeight = punctGlyph.height*rendEng.getGlobalScale();

    this.objMoving = false;

    // cache reference to this
    gui = this;

    this.setupNavBar();

    this.setupSideBar("#gui-sidebar", toggles);
    
    // set active button on startup
    $("#btn_" + toggles.initMode).trigger('click');
}

Toe.View.GUI.prototype.constructor = Toe.View.GUI;

/**
 * Inject HTML navbar links
 *
 * @methodOf Toe.View.GUI
 */
Toe.View.GUI.prototype.setupNavBar = function() {
    var gui = this;

    var nav_file_dropdown_parent = "#nav_file_dropdown";
    $(nav_file_dropdown_parent).append('<li><a id="nav_file_dropdown_revert" href="#">Revert</a></li><li class="divider"></li>' +
                                       '<li><a id="nav_file_dropdown_getmei" href="#">Get MEI</a></li>' +
                                       '<li><a id="nav_file_dropdown_getimg" href="#">Get Score Image</a></li>');
    $("#nav_file_dropdown_revert").tooltip({animation: true, 
                                            placement: 'right', 
                                            title: '<br/><br/>Revert the current MEI file to the original version. ' +
                                                   'Warning: this will revert all changes made in the editor.', 
                                            delay: 100});
    $("#nav_file_dropdown_revert").click(function() {
        // move backup mei file to working directory
        $.get(gui.prefix + "/revert/" + gui.fileName, function(data) {
            // when the backup file has been restored, reload the page
            window.location = gui.prefix + "/editor/" + gui.fileName;
        })
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to restore backup MEI file.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    });

    // MEI download
    $("#nav_file_dropdown_getmei").tooltip({animation: true, 
                                            placement: 'right', 
                                            title: 'View the MEI file of the document being edited.',
                                            delay: 100});
    // set the download path of the file
    $("#nav_file_dropdown_getmei").attr("href", this.prefix + "/file/" + this.fileName);

    // Document image rasterize
    $("#nav_file_dropdown_getimg").tooltip({animation: true, 
                                            placement: 'right', 
                                            title: 'Download an image of the document being edited.',
                                            delay: 100});
    $("#nav_file_dropdown_getimg").click(function() {
        if (!fabric.Canvas.supports('toDataURL')) {
            // show alert to user
            $("#alert > p").text("The browser you are using does not support this feature.");
        }
        else {
            window.open(gui.rendEng.canvas.toDataURL('png'));
        }
    });
}

Toe.View.GUI.prototype.setupSideBar = function(parentDivId, toggles) {
    // cache instance variable
    var gui = this;

    // create background image opacity slider
    if (toggles.sldr_bgImgOpacity) {
        $(parentDivId).prepend('<span id="sidebar-bg"><li class="nav-header">Background</li>\n' +
                               '<li>\n<label for="sldr_bgImgOpacity"><b>Image Opacity</b>:</label>\n' +
                               '<input id="sldr_bgImgOpacity" type="range" name="bgImgOpacity" ' +
                               'min="0.0" max="1.0" step="0.05" value="' + toggles.initBgImgOpacity + '" />\n</li></span>');

        $("#sldr_bgImgOpacity").bind("change", function() {
            gui.rendEng.canvas.backgroundImageOpacity = $(this).val();
            gui.rendEng.repaint();
        });
    }

    // switch to edit mode
    $("#btn_edit").bind("click.edit", {gui: gui, parentDivId: parentDivId}, this.handleEdit);

    // switch to insert mode
    $("#btn_insert").bind("click.insert", {gui: gui, parentDivId: parentDivId}, this.handleInsert);
}

Toe.View.GUI.prototype.handleEdit = function(e) {
    var gui = e.data.gui;
    var parentDivId = e.data.parentDivId;

    // first remove insert options
    $("#sidebar-insert").remove();

    // unbind insert event handlers
    gui.rendEng.unObserve("mouse:move");
    gui.rendEng.unObserve("mouse:up");

    // remove punctum following the pointer
    if (gui.punctDwg) {
        gui.rendEng.canvas.remove(gui.punctDwg);
    }

    // remove division following the pointer
    if (gui.divisionDwg) {
        gui.rendEng.canvas.remove(gui.divisionDwg);
    }
    gui.rendEng.repaint();
           
    // add buttons for edit commands
    if ($("#sidebar-edit").length == 0) {
        $(parentDivId).append('<span id="sidebar-edit"><br/><li class="divider"></li><li class="nav-header">Edit</li>\n' +
                              '<li>\n<button id="btn_delete" class="btn"><i class="icon-remove"></i> Delete</button>\n</li>\n' +
                              '<li>\n<div class="btn-group">\n<button id="btn_neumify" class="btn"><i class="icon-magnet"></i> Neumify</button>\n</li>\n' +
                              '<li><button id="btn_ungroup" class="btn"><i class="icon-share"></i> Ungroup</button></li>\n</div>\n</span>');
    }
    
    gui.rendEng.canvas.observe('mouse:down', function(e) {
        // cache pointer coordinates for mouse up
        gui.downCoords = gui.rendEng.canvas.getPointer(e.memo.e);
    });

    gui.rendEng.canvas.observe('object:moving', function(e) {
        gui.objMoving = true;
    });

    gui.rendEng.canvas.observe('object:selected', function(e) {
        var selection = gui.rendEng.canvas.getActiveObject();
        var ele = selection.eleRef;
        if (ele instanceof Toe.Model.Neume) {
            $("#info > p").html("Selected: " + ele.props.type.name + "<br/> Pitche(s): " + 
                                $.map(ele.components, function(nc) { return nc.pname.toUpperCase() + nc.oct; }).join(", "));
            $("#info").animate({opacity: 1.0}, 100);

            $("#menu_editclef").remove();

            if (ele.props.type == Toe.Model.Neume.Type.punctum) {
                if ($("#menu_editpunctum").length == 0) {
                    $("#sidebar-edit").append('<span id="menu_editpunctum"><br/><li class="nav-header">Ornamentation</li>\n' +
                                              '<li><div class="btn-group" data-toggle="buttons-checkbox">\n' +
                                              '<button id="edit_chk_dot" class="btn">&#149; Dot</button>\n' +
                                              '<button id="edit_chk_horizepisema" class="btn"><i class="icon-resize-horizontal"></i> Episema</button>\n' +
                                              '<button id="edit_chk_vertepisema" class="btn"><i class="icon-resize-vertical"></i> Episema</button>\n' +
                                              '</div></li></span>');
                }

                // toggle ornamentation
                var nc = ele.components[0];
                var hasDot = nc.hasOrnament("dot");
                if (hasDot) {
                    $("#edit_chk_dot").toggleClass("active", true);
                }
                else {
                    $("#edit_chk_dot").toggleClass("active", false);
                }

                // Handle dot toggles
                // remove onclick listener for previous selection
                $("#edit_chk_dot").unbind("click");
                $("#edit_chk_dot").bind("click.edit", {gui: gui, punctum: ele}, gui.handleDotToggle);
            }
            else {
                $("#menu_editpunctum").remove();
            }
        }
        else if (ele instanceof Toe.Model.Clef) {
            $("#info > p").text("Selected: " + ele.name);
            $("#info").animate({opacity: 1.0}, 100);

            if ($("#menu_editclef").length == 0) {
                    $("#sidebar-edit").append('<span id="menu_editclef"><br/><li class="nav-header">Clef</li>\n' +
                                              '<li><div class="btn-group" data-toggle="buttons-radio">\n' +
                                              '<button id="edit_rad_c" class="btn">Doh</button>\n' +
                                              '<button id="edit_rad_f" class="btn">Fah</button>\n</div></li></span>');
            }

            // activate appropriate radio button
            if (ele.shape == "c") {
                $("#edit_rad_c").toggleClass("active", true);
            }
            else {
                $("#edit_rad_f").toggleClass("active", true);
            }

            // Handle clef shape changes
            // remove onclick listener for previous selection
            $("#edit_rad_c").unbind("click");
            $("#edit_rad_f").unbind("click");
            $("#edit_rad_c").bind("click.edit", {gui: gui, clef: ele, shape: "c"}, gui.handleClefShapeChange);
            $("#edit_rad_f").bind("click.edit", {gui: gui, clef: ele, shape: "f"}, gui.handleClefShapeChange);
        }
        else if (ele instanceof Toe.Model.Division) {
            $("#info > p").text("Selected: " + ele.type);
            $("#info").animate({opacity: 1.0}, 100);

            $("#menu_editpunctum").remove();
            $("#menu_editclef").remove();
        }
        else {
            $("#menu_editpunctum").remove();
            $("#menu_editclef").remove();
        }
    });

    gui.rendEng.canvas.observe('selection:cleared', function(e) {
        // close info alert
        $("#info").animate({opacity: 0.0}, 100);

        // remove selection specific editing options
        $("#menu_editpunctum").remove();
        $("#menu_editclef").remove();
    });

    gui.rendEng.canvas.observe('mouse:up', function(e) {
        var upCoords = gui.rendEng.canvas.getPointer(e.memo.e);

        // get delta of the mouse movement
        var delta_x = gui.downCoords.x - upCoords.x;
        var delta_y = gui.downCoords.y - upCoords.y;
        // don't perform dragging action if the mouse doesn't move
        if (!gui.objMoving) {
            return;
        }
        
        // if something is selected we need to do some housekeeping
        var selection = gui.rendEng.canvas.getActiveObject();
        if (selection) {
            var elements = new Array();
            if (selection.eleRef) {
                elements.push(selection);
            }
            else {
                $.each(selection.objects, function(ind, el) {
                    elements.push(el);
                });
            }

            $.each(elements, function(ind, element) {
                var ele = element.eleRef;

                if (ele instanceof Toe.Model.Clef) {
                    // this is a clef
                    var left = element.left;
                    var top = element.top;
                    if (elements.length > 1) {
                        // calculate object's absolute positions from within selection group
                        left = selection.left + element.left;
                        top = selection.top + element.top;
                    }

                    // snap release position to line/space
                    var snappedCoords = ele.staff.ohSnap({x: left, y: top}, null, {ignoreEle: ele});

                    // get staff position of snapped coordinates
                    var staffPos = -Math.round((snappedCoords.y - ele.staff.zone.uly) / (ele.staff.delta_y/2));

                    ele.setStaffPosition(staffPos);

                    // gather new pitch information of affected pitched elements
                    var pitchInfo = $.map(ele.staff.getPitchedElements({clef: ele}), function(e) {
                        if (e instanceof Toe.Model.Neume) {
                            var pitchInfo = new Array();
                            $.each(e.components, function(nInd, n) {
                                pitchInfo.push({pname: n.pname, oct: n.oct});
                            });
                            return {id: e.id, noteInfo: pitchInfo};
                        }
                        else if (e instanceof Toe.Model.Custos) {
                            return {id: e.id, noteInfo: {pname: e.pname, oct: e.oct}};
                        }
                    });

                    // convert staffPos to staffLine format used in MEI attribute
                    var staffLine = ele.staff.props.numLines + (ele.props.staffPos/2);
                    var args = {id: ele.id, line: staffLine, ulx: ele.zone.ulx, uly: ele.zone.uly, lrx: ele.zone.lrx, lry: ele.zone.lry, pitchInfo: pitchInfo};

                    // send pitch shift command to server to change underlying MEI
                    $.post(gui.prefix + "/edit/" + gui.fileName + "/move/clef", {data: JSON.stringify(args)})
                    .error(function() {
                        // show alert to user
                        // replace text with error message
                        $("#alert > p").text("Server failed to move clef. Client and server are not synchronized.");
                        $("#alert").toggleClass("fade");
                    });
                }
                else if (ele instanceof Toe.Model.Neume) {
                    // we have a neume, this is a pitch shift
                    var left = element.left;
                    var top = element.top;
                    if (elements.length > 1) {
                        // calculate object's absolute positions from within selection group
                        left = selection.left + element.left;
                        top = selection.top + element.top;
                    }

                    // get y position of first neume component
                    var nc_y = element.staffRef.clef.y - (ele.rootDiff * element.staffRef.delta_y/2);
                    var finalCoords = {x: left, y: nc_y - delta_y};

                    var sModel = gui.page.getClosestStaff(finalCoords);
                    
                    // snap to staff
                    var snapCoords = sModel.ohSnap(finalCoords, element.currentWidth, {ignoreEle: ele});

                    var ncdelta_y = nc_y - snapCoords.y;

                    // change certain attributes of the element
                    // [ulx, uly, lrx, lry]
                    // construct bounding box hint: bounding box changes when dot is repositioned
                    var ulx = snapCoords.x-(element.currentWidth/2);
                    var uly = top-(element.currentHeight/2)-(finalCoords.y-snapCoords.y);
                    var bb = [ulx, uly, ulx + element.currentWidth, uly + element.currentHeight];
                    ele.setBoundingBox(bb);

                    // derive pitch name and octave of notes in the neume on the appropriate staff
                    var oldRootPname = ele.components[0].pname;
                    var oldRootOct = ele.components[0].oct;
                    for (var i = 0; i < ele.components.length; i++) {
                        var noteInfo = sModel.calcNoteInfo({x: snapCoords.x, y: snapCoords.y - (sModel.delta_y/2 * ele.components[i].pitchDiff)});
                        ele.components[i].setPitchInfo(noteInfo["pname"], noteInfo["oct"]);
                    }

                    // remove the old neume
                    element.staffRef.removeElementByRef(ele);
                         
                    // mount the new neume on the most appropriate staff
                    var nInd = sModel.addNeume(ele);

                    // get final bounding box information
                    bb = [ele.zone.ulx, ele.zone.uly, ele.zone.lrx, ele.zone.lry];

                    gui.rendEng.canvas.remove(element);

                    var args = {"nid": ele.id, "bb": {"ulx": bb[0], "uly": bb[1], "lrx": bb[2], "lry": bb[3]}};
                    if (oldRootPname != ele.components[0].pname || oldRootOct != ele.components[0].oct) {
                        // this is a pitch shift
                        args.pitchInfo = new Array();
                        $.each(ele.components, function(ncInd, nc) {
                            args.pitchInfo.push({"pname": nc.pname, "oct": nc.oct});
                        });
                    }
                    else {
                        args.pitchInfo = null
                    }

                    // get next element to insert before
                    if (nInd + 1 < sModel.elements.length) {
                        args["beforeid"] = sModel.elements[nInd+1].id;
                    }
                    else {
                        // insert before the next system break (staff)
                        var sNextModel = gui.page.getNextStaff(sModel);
                        args["beforeid"] = sNextModel.id;
                    }

                    // send pitch shift command to server to change underlying MEI
                    $.post(gui.prefix + "/edit/" + gui.fileName + "/move/neume", {data: JSON.stringify(args)})
                    .error(function() {
                        // show alert to user
                        // replace text with error message
                        $("#alert > p").text("Server failed to move neume. Client and server are not synchronized.");
                        $("#alert").toggleClass("fade");
                    });
                }
                else if (ele instanceof Toe.Model.Custos) {

                }
                else if (ele instanceof Toe.Model.Division) {
                    // this is a division
                    
                    // get closest staff
                    var staff = gui.page.getClosestStaff(upCoords);

                    var snapCoords = staff.ohSnap(upCoords, element.currentWidth, {x: true, y: false});

                    // get vertical snap coordinates for the appropriate staff
                    switch (ele.type) {
                        case Toe.Model.Division.Type.small:
                            snapCoords.y = staff.zone.uly;
                            break;
                        case Toe.Model.Division.Type.minor:
                            snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;
                            break;
                        case Toe.Model.Division.Type.major:
                            snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;
                            break;
                        case Toe.Model.Division.Type.final:
                            snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;
                            break;
                    }

                    // move to the snapped coordinates
                    element.left = snapCoords.x;
                    element.top = snapCoords.y;

                    // update bounding box data in the model
                    var ulx = snapCoords.x - element.currentWidth/2;
                    var uly = snapCoords.y - element.currentHeight/2;
                    var bb = [ulx, uly, ulx + element.currentWidth, uly + element.currentHeight];
                    ele.setBoundingBox(bb);

                    // remove division from the previous staff representation
                    element.staffRef.removeElementByRef(ele);

                    // TODO: add division to closest staff model

                    // get id of note to move before
                    var dInd = staff.insertElement(ele);
                    var beforeid = null;
                    if (dInd + 1 < staff.elements.length) {
                        beforeid = staff.elements[dInd+1].id;
                    }
                    else {
                        // insert before the next system break staff
                        var sNextModel = gui.page.getNextStaff(sModel);
                        beforeid = sNextModel.id;
                    }

                    var data = {id: ele.id, ulx: ele.zone.ulx, uly: ele.zone.uly, lrx: ele.zone.lrx, lry: ele.zone.lry, beforeid: beforeid};

                    // send move command to the server to change underlying MEI
                    $.post(gui.prefix + "/edit/" + gui.fileName + "/move/division", data)
                    .error(function() {
                        // show alert to user
                        // replace text with error message
                        $("#alert > p").text("Server failed to move division. Client and server are not synchronized.");
                        $("#alert").toggleClass("fade");
                    });
                }
            });
            // repaint canvas after all the dragging is done
            /*gui.rendEng.canvas.discardActiveObject();
            gui.rendEng.canvas.discardActiveGroup();
            gui.rendEng.canvas.fire('selection:cleared');
            gui.rendEng.repaint();*/
        }
        // we're all done moving
        gui.objMoving = false;    
    });

    // handler for delete
    $("#btn_delete").bind("click.edit", function() {
        // get current canvas selection
        // check individual selection and group selections
        toDelete = {nids: new Array(), dids: new Array()};

        var selection = gui.rendEng.canvas.getActiveObject();
        if (selection) {
            // individual element selected
            if (selection.eleRef instanceof Toe.Model.Neume) {
                toDelete.nids.push(selection.eleRef.id);
            }
            else if (selection.eleRef instanceof Toe.Model.Division) {
                toDelete.dids.push(selection.eleRef.id);
            }

            // remove element from internal representation
            selection.staffRef.removeElementByRef(selection.eleRef);

            gui.rendEng.canvas.remove(selection);
            gui.rendEng.canvas.discardActiveObject();
            gui.rendEng.repaint();
        }
        else {
            selection = gui.rendEng.canvas.getActiveGroup();
            if (selection) {
                // group of neumes selected
                for (var i = selection.objects.length-1; i >= 0; i--) {
                    if (selection.eleRef instanceof Toe.Model.Neume) {
                        toDelete.nids.push(selection.objects[i].eleRef.id);
                    }
                    else if (selection.eleRef instanceof Toe.Model.Division) {
                        toDelete.dids.push(selection.objects[i].eleRef.id);
                    }

                    // remove element from internal representation
                    selection.objects[i].staffRef.removeElementByRef(selection.objects[i].eleRef);

                    gui.rendEng.canvas.remove(selection.objects[i]);
                }
                gui.rendEng.canvas.discardActiveGroup();
                gui.rendEng.repaint();
            }
        }

        if (toDelete.nids.length > 0) {
            // send delete command to server to change underlying MEI
            $.post(gui.prefix + "/edit/" + gui.fileName + "/delete/neume",  {ids: toDelete.nids.join(",")})
            .error(function() {
                // show alert to user
                // replace text with error message
                $("#alert > p").text("Server failed to delete neume. Client and server are not synchronized.");
                $("#alert").animate({opacity: 1.0}, 100);
            });
        }
        if (toDelete.dids.length > 0) {
            // send delete command to server to change underlying MEI
            $.post(gui.prefix + "/edit/" + gui.fileName + "/delete/division", {ids: toDelete.dids.join(",")})
            .error(function() {
                // show alert to user
                // replace text with error message
                $("#alert > p").text("Server failed to delete division. Client and server are not synchronized.");
                $("#alert > p").animate({opacity: 1.0}, 100);
            });
        }
    });

    $("#btn_neumify").bind("click.edit", function() {
        // only need to neumify if a group of objects are selected
        var selection = gui.rendEng.canvas.getActiveGroup();
        if (selection) {
            // there is something selected
            // make sure there are at least 2 neumes on the same staff to work with
            var neumes = new Array();
            var sModel = null;
            $.each(selection.objects, function (ind, el) {
                if (el.eleRef instanceof Toe.Model.Neume) {
                    if (!sModel) {
                        sModel = el.staffRef;
                    }

                    if (el.staffRef == sModel) {
                        neumes.push({ref: el.eleRef, drawing: el});
                    }
                }
            });

            if (neumes.length < 2) {
                return;
            }

            // sort the group based on x position (why fabric doesn't do this, I don't know)
            neumes.sort(function(el1, el2) {
                return el1.ref.zone.ulx - el2.ref.zone.ulx;
            });

            // begin the NEUMIFICATION
            var newNeume = new Toe.Model.Neume();
                            
            numPunct = 0;
            var nids = new Array();
            var ulx = Number.MAX_VALUE;
            var uly = Number.MAX_VALUE;
            var lry = Number.MIN_VALUE;
            $.each(neumes, function (ind, el) {
                // grab underlying notes
                $.merge(newNeume.components, el.ref.components);
                numPunct += el.ref.components.length;

                // update neume ids
                nids.push(el.ref.id);

                // remove the neume, we don't need it anymore
                sModel.removeElementByRef(el.ref);
                gui.rendEng.canvas.remove(el.drawing);

                // calculate object's absolute positions from within selection group
                var left = selection.left + el.drawing.left;
                var top = selection.top + el.drawing.top;
                
                ulx = Math.min(ulx, left - el.drawing.currentHeight/2);
                uly = Math.min(uly, top - el.drawing.currentHeight/2);
                lry = Math.max(lry, top + el.drawing.currentHeight/2);
            });
            var lrx = ulx + numPunct*gui.punctWidth;

            // set the bounding box hint of the new neume for drawing
            var bb = [ulx, uly, lrx, lry];
            newNeume.setBoundingBox(bb);

            // instantiate neume view and controller
            var nView = new Toe.View.NeumeView(gui.rendEng);
            var nCtrl = new Toe.Ctrl.NeumeController(newNeume, nView);

            // render the new neume
            sModel.addNeume(newNeume);

            // get final bounding box information
            bb = [newNeume.zone.ulx, newNeume.zone.uly, newNeume.zone.lrx, newNeume.zone.lry];

            // get neume key
            var neumeKey = newNeume.props.key;

            // call server neumify function to update MEI
            $.post(gui.prefix + "/edit/" + gui.fileName + "/neumify", {nids: nids.join(","), name: neumeKey, ulx: bb[0], uly: bb[1], lrx: bb[2], lry: bb[3]}, function(data) {
                // set id of the new neume with generated ID from the server
                newNeume.id = data.nid;
            })
            .error(function() {
                // show alert to user
                // replace text with error message
                $("#alert > p").text("Server failed to neumify selected neumes. Client and server are not synchronized.");
                $("#alert").toggleClass("fade");
            });

            gui.rendEng.canvas.discardActiveGroup();
            gui.rendEng.repaint();
        }
    });

    $("#btn_ungroup").bind("click.edit", function() {
        var neumes = new Array();

        var selection = gui.rendEng.canvas.getActiveObject();
        if (selection) {
            if (selection.eleRef instanceof Toe.Model.Neume && selection.eleRef.components.length > 1) {
                neumes.push({nRef: selection.eleRef, sRef: selection.staffRef, drawing: selection});
            }
        }
        else {
            selection = gui.rendEng.canvas.getActiveGroup();
            if (selection) {
                // group of neumes selected
                for (var i = selection.objects.length-1; i >= 0; i--) {
                    var obj = selection.objects[i];
                    if (obj.eleRef instanceof Toe.Model.Neume && obj.eleRef.components.length > 1) {
                        neumes.push({nRef: obj.eleRef, sRef: obj.staffRef, drawing: obj});
                    }
                }
            }
        }

        var nids = new Array();
        var bbs = new Array();
        var punctums = new Array();

        // ungroup each selected neume
        $.each(neumes, function(nInd, nel) {
            // add to list of neume ids
            nids.push(nel.nRef.id);

            var punctBoxes = new Array();
            var ulx = nel.nRef.zone.ulx;

            // remove the old neume
            nel.sRef.removeElementByRef(nel.nRef);
            gui.rendEng.canvas.remove(nel.drawing);

            $.each(nel.nRef.components, function(ncInd, nc) {
                var newPunct = new Toe.Model.Neume();
                newPunct.components.push(nc);

                var uly = nel.sRef.clef.y - (nel.nRef.rootDiff+nc.pitchDiff)*nel.sRef.delta_y/2 - gui.punctHeight/2;
                // set the bounding box hint of the new neume for drawing
                var bb = [ulx+(ncInd*gui.punctWidth), uly, ulx+((ncInd+1)*gui.punctWidth), uly+gui.punctHeight];
                newPunct.setBoundingBox(bb);

                // instantiate neume view and controller
                var nView = new Toe.View.NeumeView(gui.rendEng);
                var nCtrl = new Toe.Ctrl.NeumeController(newPunct, nView);

                // add the punctum to the staff and draw it
                nel.sRef.addNeume(newPunct);

                // get final bounding box information
                punctBoxes.push({"ulx": newPunct.zone.ulx, "uly": newPunct.zone.uly, "lrx": newPunct.zone.lrx, "lry": newPunct.zone.lry});

                punctums.push(newPunct);
            });

            // add to list of neume bounding boxes
            bbs.push(punctBoxes);
        });

        var data = JSON.stringify({"nids": nids.join(","), "bbs": bbs});

        // call server ungroup function to update MEI
        $.post(gui.prefix + "/edit/" + gui.fileName + "/ungroup", {data: data}, function(data) {
            // set ids of the new puncta from the IDs generated from the server
            var nids = JSON.parse(data).nids;
            $.each(punctums, function(i, punct) {
                punct.id = nids[i];
            });
        })
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to ungroup selected neumes. Client and server are not synchronized.");
            $("#alert").toggleClass("fade");
        });

        gui.rendEng.canvas.discardActiveObject();
        gui.rendEng.canvas.discardActiveGroup();
        gui.rendEng.repaint();
    });
}

Toe.View.GUI.prototype.handleDotToggle = function(e) {
    var gui = e.data.gui;
    var punctum = e.data.punctum;

    var hasDot = punctum.components[0].hasOrnament("dot");
    if (!hasDot) {
        // add a dot
        var ornament = new Toe.Model.Ornament("dot", {form: "aug"});
        punctum.components[0].addOrnament(ornament);
    }
    else {
        // remove the dot
        punctum.components[0].removeOrnament("dot");
    }

    // update neume drawing
    punctum.syncDrawing();

    // get final bounding box information
    var args = {id: punctum.id, dotform: "aug", ulx: punctum.zone.ulx, uly: punctum.zone.uly, lrx: punctum.zone.lrx, lry: punctum.zone.lry};
    if (!hasDot) {
        // send add dot command to server to change underlying MEI
        $.post(gui.prefix + "/edit/" + gui.fileName + "/insert/dot", args)
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to add a dot to the punctum. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }
    else {
        // send remove dot command to server to change underlying MEI
        $.post(gui.prefix + "/edit/" + gui.fileName + "/delete/dot", args)
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to remove dot from the punctum. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }

    $(this).toggleClass("active");
}

Toe.View.GUI.prototype.handleClefShapeChange = function(e) {
    var gui = e.data.gui;
    var clef = e.data.clef;
    var cShape = e.data.shape;

    if (clef.shape != cShape) {
        clef.setShape(cShape);

        var pitchInfo = $.map(clef.staff.getPitchedElements({clef: clef}), function(e) {
            if (e instanceof Toe.Model.Neume) {
                var pitchInfo = new Array();
                $.each(e.components, function(nInd, n) {
                    pitchInfo.push({pname: n.pname, oct: n.oct});
                });
                return {id: e.id, noteInfo: pitchInfo};
            }
            else if (e instanceof Toe.Model.Custos) {
                return {id: e.id, noteInfo: {pname: e.pname, oct: e.oct}};
            }
        });

        var args = {id: clef.id, shape: cShape, ulx: clef.zone.ulx, uly: clef.zone.uly, lrx: clef.zone.lrx, lry: clef.zone.lry, pitchInfo: pitchInfo};

        // send pitch shift command to server to change underlying MEI
        $.post(gui.prefix + "/edit/" + gui.fileName + "/update/clef/shape", {data: JSON.stringify(args)})
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to update clef shape. Client and server are not synchronized.");
            $("#alert").toggleClass("fade");
        });

        $(this).toggleClass("active");
    }
}

Toe.View.GUI.prototype.handleInsert = function(e) {
    var gui = e.data.gui;
    var parentDivId = e.data.parentDivId;

    // first remove edit options
    $("#sidebar-edit").remove();

    // unbind edit event handlers
    $("#btn_delete").unbind("click.edit");
    $("#btn_neumify").unbind("click.edit");

    // unbind move event handlers
    gui.rendEng.unObserve("mouse:down");
    gui.rendEng.unObserve("mouse:up");
    gui.rendEng.unObserve("object:moving");
    gui.rendEng.unObserve("object:selected");
    gui.rendEng.unObserve("selection:cleared");

    // then add insert options
    if ($("#sidebar-insert").length == 0) {
        $(parentDivId).append('<span id="sidebar-insert"><br/><li class="divider"></li><li class="nav-header">Insert</li>\n' +
                              '<li><div class="btn-group" data-toggle="buttons-radio">' +
                              '<button id="rad_punctum" class="btn"><i class="icon-bookmark icon-black"></i> Punctum</button>\n' +
                              '<button id="rad_division" class="btn"><b>||</b> Division</button>\n</div>\n</li>\n</span>');
    }

    $("#rad_punctum").bind("click.insert", function() {
        // unbind other event handlers
        gui.rendEng.unObserve("mouse:move");
        gui.rendEng.unObserve("mouse:up");

        // remove insert division menu
        $("#menu_insertdivision").remove();

        if (gui.divisionDwg) {
            // remove drawn division
            gui.rendEng.canvas.remove(gui.divisionDwg);
            gui.rendEng.repaint();
        }

        // add ornamentation toggles
        if ($("#menu_insertpunctum").length == 0) {
            $("#sidebar-insert").append('<span id="menu_insertpunctum"><br/><li class="nav-header">Ornamentation</li>\n' +
                                        '<li><div class="btn-group" data-toggle="buttons-checkbox">\n' +
                                        '<button id="chk_dot" class="btn">&#149; Dot</button>\n' +
                                        '<button id="chk_horizepisema" class="btn"><i class="icon-resize-horizontal"></i> Episema</button>\n' +
                                        '<button id="chk_vertepisema" class="btn"><i class="icon-resize-vertical"></i> Episema</button>\n</div></li></span>');
        }

        // ornamentation toggle flags
        var hasDot = false;
        var hasHorizEpisema = false;
        var hasVertEpisema = false;

        var updateFollowPunct = function(initial) {
            var elements = {modify: new Array(), static: new Array()};

            var punctPos = null;
            var punctGlyph = gui.rendEng.getGlyph("punctum");
            if (initial) {
                // draw the punctum off the screen, initially
                var punctPos = {left: -50, top: -50};
            }
            else {
                var punctPos = {left: gui.punctDwg.left, top: gui.punctDwg.top};

                if (hasDot) {
                    var glyphDot = gui.rendEng.getGlyph("dot");
                    var dot = glyphDot.clone().set({left: punctPos.left + gui.punctWidth, top: punctPos.top, opacity: 0.6});
                    elements.modify.push(dot);
                }

                if (hasHorizEpisema) {
                }

                if (hasVertEpisema) {
                }

            }

            // create clean punctum glyph with no ornamentation
            var punct = punctGlyph.clone().set({left: punctPos.left, top: punctPos.top, opacity: 0.6});
            elements.modify.push(punct);

            // remove old punctum drawing following the pointer
            if (gui.punctDwg) {
                gui.rendEng.canvas.remove(gui.punctDwg);
            }

            // replace with new punctum drawing
            gui.punctDwg = gui.rendEng.draw(elements, {group: true, selectable: false, repaint: true})[0]; 
        };

        // put the punctum off the screen for now
        updateFollowPunct(true);

        // render transparent punctum at pointer location
        gui.rendEng.canvas.observe('mouse:move', function(e) {
            var pnt = gui.rendEng.canvas.getPointer(e.memo.e);
            gui.punctDwg.left = pnt.x - gui.punctDwg.currentWidth/4;
            gui.punctDwg.top = pnt.y - gui.punctDwg.currentHeight/4;

            gui.rendEng.repaint();
        });

        gui.rendEng.canvas.observe('mouse:up', function(e) {
            var coords = {x: gui.punctDwg.left, y: gui.punctDwg.top};
            var sModel = gui.page.getClosestStaff(coords);

            // instantiate a punctum
            var nModel = new Toe.Model.Neume();

            // calculate snapped coords
            var snapCoords = sModel.ohSnap(coords, gui.punctDwg.currentWidth);

            // update bounding box with physical position on the page
            var ulx = snapCoords.x - gui.punctDwg.currentWidth/2;
            var uly = snapCoords.y - gui.punctDwg.currentHeight/2;
            var bb = [ulx, uly, ulx + gui.punctDwg.currentWidth, uly + gui.punctDwg.currentHeight];
            nModel.setBoundingBox(bb);

            // get pitch name and octave of snapped coords of note
            var noteInfo = sModel.calcNoteInfo(snapCoords);
            var pname = noteInfo["pname"];
            var oct = noteInfo["oct"];

            //  start forming arguments for the server function call
            var args = {pname: pname, oct: oct};

            // check ornamentation toggles to add to component
            var ornaments = new Array();
            if (hasDot) {
                ornaments.push(new Toe.Model.Ornament("dot", {form: "aug"}));
                args["dotform"] = "aug";
            }
            if (hasHorizEpisema) {

            }
            if (hasVertEpisema) {

            }
            nModel.addComponent("punctum", pname, oct, {ornaments: ornaments});

            // instantiate neume view and controller
            var nView = new Toe.View.NeumeView(gui.rendEng);
            var nCtrl = new Toe.Ctrl.NeumeController(nModel, nView);
            
            // mount neume on the staff
            var nInd = sModel.addNeume(nModel);

            // now that final bounding box is calculated from the drawing
            // add the bounding box information to the server function arguments
            args["ulx"] = nModel.zone.ulx;
            args["uly"] = nModel.zone.uly;
            args["lrx"] = nModel.zone.lrx;
            args["lry"] = nModel.zone.lry;

            // get next element to insert before
            if (nInd + 1 < sModel.elements.length) {
                args["beforeid"] = sModel.elements[nInd+1].id;
            }
            else {
                // insert before the next system break (staff)
                var sNextModel = gui.page.getNextStaff(sModel);
                if (sNextModel) {
                    args["beforeid"] = sNextModel.id;
                }
            }

            // send insert command to server to change underlying MEI
            $.post(gui.prefix + "/edit/" + gui.fileName + "/insert/neume", args, function(data) {
                nModel.id = JSON.parse(data).nid;
            })
            .error(function() {
                // show alert to user
                // replace text with error message
                $("#alert > p").text("Server failed to insert neume. Client and server are not synchronized.");
                $("#alert").toggleClass("fade");
            });
        });

        $("#chk_dot").bind("click.insert", function() {
            // toggle dot
            if (!hasDot) {
                hasDot = true;
            }
            else {
                hasDot = false;
            }

            updateFollowPunct(false);
        });

        /*$("#chk_horizepisema").bind("click.insert", function() {
            if ($(this).hasClass("active")) {
                hasHorizEpisema = true;
            }
            else {
                hasHorizEpisema = false;
            }
        });

        $("#chk_vertepisema").bind("click.insert", function() {
        });*/
    });

    $("#rad_division").bind("click.insert", function() {
        // unbind insert punctum event handlers
        gui.rendEng.unObserve("mouse:move");
        gui.rendEng.unObserve("mouse:up");

        // remove the pointer following punctum
        gui.rendEng.canvas.remove(gui.punctDwg);
        gui.rendEng.repaint();

        // remove ornamentation UI elements - not needed for divisions
        $("#menu_insertpunctum").remove();

        // add division type toggles
        if ($("#menu_insertdivision").length == 0) {
            $("#sidebar-insert").append('<span id="menu_insertdivision"><br/>\n<li class="nav-header">Division Type</li>\n' +
                                        '<li><div class="btn-group" data-toggle="buttons-radio">\n' +
                                        '<button id="rad_small" class="btn">Small</button>\n' +
                                        '<button id="rad_minor" class="btn">Minor</button>\n' +
                                        '<button id="rad_major" class="btn">Major</button>\n' +
                                        '<button id="rad_final" class="btn">Final</button>\n</div>\n</li>\n</span>');
        }

        var divisionForm = null;
        var staff = null;

        gui.rendEng.canvas.observe('mouse:move', function(e) {
            var pnt = gui.rendEng.canvas.getPointer(e.memo.e);

            // get closest staff
            staff = gui.page.getClosestStaff(pnt);

            var snapCoords = pnt;
            var divProps = {strokeWidth: 4, opacity: 0.6};
            switch (divisionForm) {
                case "small":
                    snapCoords.y = staff.zone.uly;

                    if (!gui.divisionDwg) {
                        var y1 = staff.zone.uly - staff.delta_y/2;
                        var y2 = staff.zone.uly + staff.delta_y/2;
                        var x1 = snapCoords.x;

                        gui.divisionDwg = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                        gui.rendEng.draw({static: [gui.divisionDwg], modify: []}, {selectable: false, opacity: 0.6});
                    }
                    break;
                case "minor":
                    snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;

                    if (!gui.divisionDwg) {
                        var y1 = staff.zone.uly + staff.delta_y/2;
                        var y2 = y1 + 2*staff.delta_y;
                        var x1 = snapCoords.x;

                        gui.divisionDwg = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                        gui.rendEng.draw({static: [gui.divisionDwg], modify: []}, {selectable: false, opacity: 0.6});
                    }
                    break;
                case "major":
                    snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;

                    if (!gui.divisionDwg) {
                        var y1 = staff.zone.uly;
                        var y2 = staff.zone.lry;
                        var x1 = snapCoords.x;

                        gui.divisionDwg = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                        gui.rendEng.draw({static: [gui.divisionDwg], modify: []}, {selectable: false, opacity: 0.6});
                    }
                    break;
                case "final":
                    snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;

                    if (!gui.divisionDwg) {
                        var y1 = staff.zone.uly;
                        var y2 = staff.zone.lry;
                        var x1 = snapCoords.x;
                        // make width equal to width of punctum glyph
                        var x2 = snapCoords.x + gui.punctWidth;

                        var div1 = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                        var div2 = gui.rendEng.createLine([x2, y1, x2, y2], divProps);
                        gui.divisionDwg = gui.rendEng.draw({static: [div1, div2], modify: []}, {group: true, selectable: false, opacity: 0.6})[0];
                    }
                    break;
            }                    

            // snap the drawing to the staff on the x-plane
            var dwgLeft = pnt.x - gui.divisionDwg.currentWidth/2;
            var dwgRight = pnt.x + gui.divisionDwg.currentWidth/2;
            if (staff.clef && dwgLeft <= staff.clef.zone.lrx) {
                snapCoords.x = staff.clef.zone.lrx + gui.divisionDwg.currentWidth/2 + 1;
            }
            else if (dwgLeft <= staff.zone.ulx) {
                snapCoords.x = staff.zone.ulx + gui.divisionDwg.currentWidth/2 + 1;
            }

            if (staff.custos && dwgRight >= staff.custos.zone.ulx) {
                // 3 is a magic number just to give it some padding
                snapCoords.x = staff.custos.zone.ulx - gui.divisionDwg.currentWidth/2 - 3;
            }
            else if (dwgRight >= staff.zone.lrx) {
                snapCoords.x = staff.zone.lrx - gui.divisionDwg.currentWidth/2 - 3;
            }

            // move around the drawing
            gui.divisionDwg.left = snapCoords.x;
            gui.divisionDwg.top = snapCoords.y;
            gui.rendEng.repaint();
        });

        gui.rendEng.canvas.observe('mouse:up', function(e) {
            // get coords
            var coords = {x: gui.divisionDwg.left, y: gui.divisionDwg.top};

            // calculate snapped coords
            var snapCoords = staff.ohSnap(coords, gui.divisionDwg.currentWidth);

            var division = new Toe.Model.Division(divisionForm);

            // update bounding box with physical position on the page
            var ulx = snapCoords.x - gui.divisionDwg.currentWidth/2;
            var uly = snapCoords.y - gui.divisionDwg.currentHeight/2;
            var bb = [ulx, uly, ulx + gui.divisionDwg.currentWidth, uly + gui.divisionDwg.currentHeight];
            division.setBoundingBox(bb);

            // instantiate division view and controller
            var dView = new Toe.View.DivisionView(gui.rendEng);
            var dCtrl = new Toe.Ctrl.DivisionController(division, dView);

            // mount division on the staff
            var nInd = staff.addDivision(division);

            var args = {type: division.key, ulx: bb[0], uly: bb[1], lrx: bb[2], lry: bb[3]};
            // get next element to insert before
            if (nInd + 1 < staff.elements.length) {
                args["beforeid"] = staff.elements[nInd+1].id;   
            }
            else {
                // insert before the next system break (staff)
                var sNextModel = gui.page.getNextStaff(staff);
                args["beforeid"] = sNextModel.id;
            }

            // send insert division command to server to change underlying MEI
            $.post(gui.prefix + "/edit/" + gui.fileName + "/insert/division", args, function(data) {
                division.id = JSON.parse(data).id;
            })
            .error(function() {
                // show alert to user
                // replace text with error message
                $("#alert > p").text("Server failed to insert division. Client and server are not synchronized.");
                $("#alert").toggleClass("fade");
            });
        });

        $("#rad_small").bind("click.insert", function() {
            // remove the current division following the pointer
            if (gui.divisionDwg) {
                gui.rendEng.canvas.remove(gui.divisionDwg);
                gui.divisionDwg = null;
            }
            divisionForm = "small";
        });

        $("#rad_minor").bind("click.insert", function() {
            if (gui.divisionDwg) {
                gui.rendEng.canvas.remove(gui.divisionDwg);
                gui.divisionDwg = null;
            }
            divisionForm = "minor";
        });

        $("#rad_major").bind("click.insert", function() {
            if (gui.divisionDwg) {
                gui.rendEng.canvas.remove(gui.divisionDwg);
                gui.divisionDwg = null;
            }
            divisionForm = "major";
        });

        $("#rad_final").bind("click.insert", function() {
            if (gui.divisionDwg) {
                gui.rendEng.canvas.remove(gui.divisionDwg);
                gui.divisionDwg = null;
            }
            divisionForm = "final";
        });

        // toggle small division by default
        $("#rad_small").trigger('click');
    });

    // toggle punctum insert by default
    $("#rad_punctum").trigger('click');
}
