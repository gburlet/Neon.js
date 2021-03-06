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
Toe.View.GUI = function(apiprefix, meipath, dwgLib, rendEng, page, guiToggles) {
    var toggles = {
        sldr_bgImgOpacity: true,
        sldr_glyphOpacity: true,
        initGlyphOpacity: 1.0,
        initBgImgOpacity: 0.60,
        initMode: "edit"
    };

    $.extend(toggles, guiToggles);

    this.rendEng = rendEng;
    this.page = page;
    this.apiprefix = apiprefix;
    this.meipath = meipath;
    this.dwgLib = dwgLib;

    // these are variables holding pointers to the drawings
    // that follow around the pointer in insert mode.
    this.punctDwg = null;
    this.divisionDwg = null;
    this.clefDwg = null;

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

    this.bindHotkeys();
    
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
    // check if the file menu is included in the template (avoid including bootstrap.js if possible)
    if ($(nav_file_dropdown_parent).length) {
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
            $.get(gui.apiprefix + "/revert", function(data) {
                // when the backup file has been restored, reload the page
                window.location.reload();
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
        $("#nav_file_dropdown_getmei").attr("href", gui.meipath);

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
}

Toe.View.GUI.prototype.setupSideBar = function(parentDivId, toggles) {
    // cache instance variable
    var gui = this;

    // create container for appearance sliders
    if (toggles.sldr_bgImgOpacity || toggles.sldr_glyphOpacity) {
        $(parentDivId).prepend('<span id="sidebar-app"><li class="nav-header">Appearance</li>\n</span>');

        // create background image opacity slider
        if (toggles.sldr_bgImgOpacity) {
            $("#sidebar-app").append('<li>\n<label for="sldr_bgImgOpacity"><b>Image Opacity</b>:</label>\n' +
                                   '<input id="sldr_bgImgOpacity" style="width: 95%;" type="range" name="bgImgOpacity" ' +
                                   'min="0.0" max="1.0" step="0.05" value="' + toggles.initBgImgOpacity + '" />\n</li>');

            $("#sldr_bgImgOpacity").bind("change", function() {
                gui.rendEng.canvas.backgroundImageOpacity = $(this).val();
                gui.rendEng.repaint();
            });
        }

        // create glyph opacity slider
        if (toggles.sldr_glyphOpacity) {
            $("#sidebar-app").append('<li>\n<label for="sldr_glyphOpacity"><b>Glyph Opacity</b>:</label>\n' + 
                                   '<input id="sldr_glyphOpacity" style="width: 95%;" type="range" name="glyphOpacity" ' + 
                                   'min="0.0" max="1.0" step="0.05" value="' + toggles.initGlyphOpacity + '" />\n</li>');

            $("#sldr_glyphOpacity").bind("change", function() {
                var opacity = $(this).val();
                gui.rendEng.canvas.forEachObject(function(obj) {
                    obj.setOpacity(opacity);
                });

                gui.rendEng.repaint();
            });
        }
    }

    // switch to edit mode
    $("#btn_edit").bind("click.edit", {gui: gui, parentDivId: parentDivId}, this.handleEdit);

    // switch to insert mode
    $("#btn_insert").bind("click.insert", {gui: gui, parentDivId: parentDivId}, this.handleInsert);
}

Toe.View.GUI.prototype.bindHotkeys = function() {
    // edit mode hotkey
    Mousetrap.bind(['e', 'Ctrl+e', 'Command+e'], function() {
        $("#btn_edit").click();
        return false;
    });

    // insert mode hotkey
    Mousetrap.bind(['i', 'Ctrl+i', 'Command+i'], function() {
        $("#btn_insert").click();
        return false;
    });

    // delete hotkey
    Mousetrap.bind(['del', 'backspace'], function() {
        $("#btn_delete").trigger('click.edit', {gui:gui}, gui.handleDelete);
        return false;
    });

    Mousetrap.bind(['n', 'Ctrl+n', 'Command+n'], function() {
        $("#btn_neumify").trigger('click.edit', {gui:gui}, gui.handleNeumify);
        return false;
    });

    Mousetrap.bind(['u', 'Ctrl+u', 'Command+u'], function() {
        $("#btn_ungroup").trigger('click.edit', {gui:gui}, gui.handleUngroup);
        return false;
    });
}

/**************************************************
 *                  EDIT                          *
 **************************************************/
Toe.View.GUI.prototype.handleEdit = function(e) {
    var gui = e.data.gui;
    var parentDivId = e.data.parentDivId;

    // activate all objects on the canvas 
    // so they can be modified in edit mode
    gui.rendEng.canvas.selection = true;
    gui.rendEng.canvas.HOVER_CURSOR = "pointer";

    // first remove insert options
    $("#sidebar-insert").remove();

    // unbind insert event handlers
    gui.rendEng.unObserve("mouse:move");
    gui.rendEng.unObserve("mouse:up");

    // remove drawings following the pointer from insert mode
    if (gui.punctDwg) {
        gui.rendEng.canvas.remove(gui.punctDwg);
    }
    if (gui.divisionDwg) {
        gui.rendEng.canvas.remove(gui.divisionDwg);
    }
    if (gui.clefDwg) {
        gui.rendEng.canvas.remove(gui.clefDwg);
    }
    gui.rendEng.repaint();
           
    // add buttons for edit commands
    if ($("#sidebar-edit").length == 0) {
        $(parentDivId).append('<span id="sidebar-edit"><br/><li class="divider"></li><li class="nav-header">Edit</li>\n' +
                              '<li>\n<button id="btn_delete" class="btn"><i class="icon-remove"></i> Delete</button>\n</li>\n' +
                              '<li>\n<div class="btn-group">\n<button id="btn_neumify" class="btn"><i class="icon-magnet"></i> Neumify</button>\n' +
                              '<button class="btn dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></button>\n' +
                              '<ul class="dropdown-menu"><li><a id="btn_neumify_liquescence">liquescence</a></li></ul></li>\n' +
                              '<li><button id="btn_ungroup" class="btn"><i class="icon-share"></i> Ungroup</button></li>\n</div>\n</span>');
    }
    
    // grey out edit buttons by default
    $('#btn_delete').toggleClass('disabled', true);
    $('#btn_neumify').toggleClass('disabled', true);
    $('#btn_neumify_liquescence').toggleClass('disabled', true);
    $('#btn_ungroup').toggleClass('disabled', true);

    gui.rendEng.canvas.observe('mouse:down', function(e) {
        // cache pointer coordinates for mouse up
        gui.downCoords = gui.rendEng.canvas.getPointer(e.e);
    });

    gui.rendEng.canvas.observe('object:moving', function(e) {
        gui.objMoving = true;
    });

    gui.rendEng.canvas.observe('selection:created', function(e) {
        var selection = e.target;
        selection.hasControls = false;
        selection.borderColor = 'rgba(102,153,255,1.0)';

        // disable/enable buttons
        var toNeumify = 0;
        var toUngroup = 0;
        var sModel = null;
        $.each(selection.getObjects(), function (oInd, o) {
            // don't draw a selection border around each object in the selection
            o.borderColor = 'rgba(0,0,0,0)'; 

            if (o.eleRef instanceof Toe.Model.Neume) {
                if (!sModel) {
                    sModel = o.eleRef.staff;
                }
                
                toUngroup++;

                if (o.eleRef.staff == sModel) {
                    toNeumify++;
                }
            }
        });

        $('#btn_delete').toggleClass('disabled', false);

        if (toNeumify < 2) {
            $('#btn_neumify').toggleClass('disabled', true);
            $('#btn_neumify_liquescence').toggleClass('disabled', true);
        }
        else {
            $('#btn_neumify').toggleClass('disabled', false);
            $('#btn_neumify_liquescence').toggleClass('disabled', false);
        }

        if (toUngroup > 0) {
            $('#btn_ungroup').toggleClass('disabled', false);
        }
        else {
            $('#btn_ungroup').toggleClass('disabled', true);
        }
    });

    gui.rendEng.canvas.observe('object:selected', function(e) {
        $('#btn_delete').toggleClass('disabled', false);

        var selection = gui.rendEng.canvas.getActiveObject();
        var ele = selection.eleRef;
        if (ele instanceof Toe.Model.Neume) {
            $("#info > p").html("Selected: " + ele.name + "<br/> Pitche(s): " + 
                                $.map(ele.components, function(nc) { return nc.pname.toUpperCase() + nc.oct; }).join(", "));
            $("#info").animate({opacity: 1.0}, 100);

            $('#btn_ungroup').toggleClass('disabled', false);

            $("#menu_editclef").remove();

            if (ele.typeid == "punctum" || ele.typeid == "cavum" || ele.typeid == "virga") {
                if ($("#menu_editpunctum").length == 0) {
                    $("#sidebar-edit").append('<span id="menu_editpunctum"><br/><li class="nav-header">Ornamentation</li>\n' +
                                              '<li><div class="btn-group" data-toggle="buttons-checkbox">\n' +
                                              '<button id="edit_chk_dot" class="btn">&#149; Dot</button>\n' +
                                              '<button id="edit_chk_horizepisema" class="btn"><i class="icon-resize-horizontal"></i> Episema</button>\n' +
                                              '<button id="edit_chk_vertepisema" class="btn"><i class="icon-resize-vertical"></i> Episema</button>\n</div></li>\n' + 
                                              '<br/><li class="nav-header">Attributes</li>\n' +
                                              '<li><div class="btn-group"><a class="btn dropdown-toggle" data-toggle="dropdown">\n' + 
                                              'Head shape <span class="caret"></span></a><ul class="dropdown-menu">\n' + 
                                              '<li><a id="head_punctum">punctum</a></li>\n' +
                                              '<li><a id="head_punctum_inclinatum">punctum inclinatum</a></li>\n' +
                                              '<li><a id="head_punctum_inclinatum_parvum">punctum inclinatum parvum</a></li>\n' +
                                              '<li><a id="head_cavum">cavum</a></li>\n' +
                                              '<li><a id="head_virga">virga</a></li>\n' +
                                              '<li><a id="head_quilisma">quilisma</a></li>\n' +
                                              '</ul></div></span>');
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

                // Handle head shape change
                $("#head_punctum").unbind("click");
                $("#head_cavum").unbind("click");
                $("#head_virga").unbind("click");
                $("#head_quilisma").unbind("click");
                $("#head_punctum_inclinatum").unbind("click");
                $("#head_punctum_inclinatum_parvum").unbind("click");
                $("#head_punctum").bind("click.edit", {gui: gui, punctum: ele, shape: "punctum"}, gui.handleHeadShapeChange);
                $("#head_cavum").bind("click.edit", {gui: gui, punctum: ele, shape: "cavum"}, gui.handleHeadShapeChange);
                $("#head_virga").bind("click.edit", {gui: gui, punctum: ele, shape: "virga"}, gui.handleHeadShapeChange);
                $("#head_quilisma").bind("click.edit", {gui: gui, punctum: ele, shape: "quilisma"}, gui.handleHeadShapeChange);
                $("#head_punctum_inclinatum").bind("click.edit", {gui: gui, punctum: ele, shape: "punctum_inclinatum"}, gui.handleHeadShapeChange);
                $("#head_punctum_inclinatum_parvum").bind("click.edit", {gui: gui, punctum: ele, shape: "punctum_inclinatum_parvum"}, gui.handleHeadShapeChange);
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
                                              '<button id="edit_rad_c" class="btn">C</button>\n' +
                                              '<button id="edit_rad_f" class="btn">F</button>\n</div></li></span>');
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
        else if (ele instanceof Toe.Model.Custos) {
            $("#info > p").html("Selected: Custos <br/> Pitch: " + ele.pname.toUpperCase() + ele.oct);
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

        $('#btn_delete').toggleClass('disabled', true);
        $('#btn_neumify').toggleClass('disabled', true);
        $('#btn_neumify_liquescence').toggleClass('disabled', true);
        $('#btn_ungroup').toggleClass('disabled', true);
    });

    gui.rendEng.canvas.observe('mouse:up', function(e) {
        var upCoords = gui.rendEng.canvas.getPointer(e.e);

        // get delta of the mouse movement
        var delta_x = gui.downCoords.x - upCoords.x;
        var delta_y = gui.downCoords.y - upCoords.y;
        // don't perform dragging action if the mouse doesn't move
        if (!gui.objMoving) {
            return;
        }
        
        // if something is selected we need to do some housekeeping
        // check for single selection
        var selection = gui.rendEng.canvas.getActiveObject();
        if (!selection) {
            // check for group selection
            selection = gui.rendEng.canvas.getActiveGroup();
        }

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

                    // TODO clefs moving to different staves?

                    // get staff position of snapped coordinates
                    var staffPos = -Math.round((snappedCoords.y - ele.staff.zone.uly) / (ele.staff.delta_y/2));

                    ele.setStaffPosition(staffPos);

                    var neumesOnStaff = ele.staff.getPitchedElements({neumes: true, custos: false});
                    if (neumesOnStaff.length > 0 && ele.staff.getActingClefByEle(neumesOnStaff[0]) == ele) {
                        // if the shift of the clef has affected the first neume on this staff
                        // update the custos on the previous staff
                        var prevStaff = gui.page.getPreviousStaff(ele.staff);
                        if (prevStaff) {
                            var newPname = neumesOnStaff[0].components[0].pname;
                            var newOct = neumesOnStaff[0].components[0].oct;
                            gui.handleUpdatePrevCustos(newPname, newOct, prevStaff);
                        }
                    }

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
                            // the custos has been vertically moved
                            // update the custos bounding box information in the model
                            // do not need to update pitch name & octave since this does not change
                            var outbb = gui.getOutputBoundingBox([e.zone.ulx, e.zone.uly, e.zone.lrx, e.zone.lry]);
                            $.post(gui.apiprefix + "/move/custos", {id: e.id, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]})
                            .error(function() {
                                // show alert to user
                                // replace text with error message
                                $("#alert > p").text("Server failed to move custos. Client and server are not synchronized.");
                                $("#alert").animate({opacity: 1.0}, 100);
                            });
                        }
                    });

                    // convert staffPos to staffLine format used in MEI attribute
                    var staffLine = ele.staff.props.numLines + (ele.props.staffPos/2);
                    var outbb = gui.getOutputBoundingBox([ele.zone.ulx, ele.zone.uly, ele.zone.lrx, ele.zone.lry]);
                    var args = {id: ele.id, line: staffLine, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3], pitchInfo: pitchInfo};

                    // send pitch shift command to server to change underlying MEI
                    $.post(gui.apiprefix + "/move/clef", {data: JSON.stringify(args)})
                    .error(function() {
                        // show alert to user
                        // replace text with error message
                        $("#alert > p").text("Server failed to move clef. Client and server are not synchronized.");
                        $("#alert").animate({opacity: 1.0}, 100);
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
                    var nc_y = ele.staff.zone.uly - ele.rootStaffPos*ele.staff.delta_y/2;
                    var finalCoords = {x: left, y: nc_y - delta_y};

                    var sModel = gui.page.getClosestStaff(finalCoords);
                    
                    // snap to staff
                    var snapCoords = sModel.ohSnap(finalCoords, element.currentWidth, {ignoreEle: ele});

                    var newRootStaffPos = Math.round((sModel.zone.uly - snapCoords.y) / (sModel.delta_y/2));

                    // construct bounding box hint for the new drawing: bounding box changes when dot is repositioned
                    var ulx = snapCoords.x-(element.currentWidth/2);
                    var uly = top-(element.currentHeight/2)-(finalCoords.y-snapCoords.y);
                    var bb = [ulx, uly, ulx + element.currentWidth, uly + element.currentHeight];
                    ele.setBoundingBox(bb);

                    var oldRootStaffPos = ele.rootStaffPos;
                    // derive pitch name and octave of notes in the neume on the appropriate staff
                    $.each(ele.components, function(ncInd, nc) {
                        var noteInfo = sModel.calcPitchFromCoords({x: snapCoords.x, y: snapCoords.y - (sModel.delta_y/2 * nc.pitchDiff)});
                        nc.setPitchInfo(noteInfo["pname"], noteInfo["oct"]);
                    });

                    // remove the old neume
                    $(ele).trigger("vEraseDrawing");
                    ele.staff.removeElementByRef(ele);
     
                    // mount the new neume on the most appropriate staff
                    var nInd = sModel.addNeume(ele);
                    if (elements.length == 1) {
                        $(ele).trigger("vSelectDrawing");
                    }

                    var outbb = gui.getOutputBoundingBox([ele.zone.ulx, ele.zone.uly, ele.zone.lrx, ele.zone.lry]);
                    var args = {id: ele.id, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]};
                    if (oldRootStaffPos != newRootStaffPos) {
                        // this is a pitch shift
                        args.pitchInfo = new Array();
                        $.each(ele.components, function(ncInd, nc) {
                            args.pitchInfo.push({"pname": nc.pname, "oct": nc.oct});
                        });

                        // if this element is the first neume on the staff
                        if (ele == sModel.elements[1]) {
                            var prevStaff = gui.page.getPreviousStaff(sModel);
                            if (prevStaff) {
                                var cPname = ele.components[0].pname;
                                var cOct = ele.components[0].oct;
                                gui.handleUpdatePrevCustos(cPname, cOct, prevStaff);
                            }
                        }
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
                    $.post(gui.apiprefix + "/move/neume", {data: JSON.stringify(args)})
                    .error(function() {
                        // show alert to user
                        // replace text with error message
                        $("#alert > p").text("Server failed to move neume. Client and server are not synchronized.");
                        $("#alert").animate({opacity: 1.0}, 100);
                    });
                }
                else if (ele instanceof Toe.Model.Division) {
                    // this is a division
                    var left = element.left;
                    var top = element.top;
                    if (elements.length > 1) {
                        // calculate object's absolute positions from within selection group
                        left += selection.left;
                        top += selection.top;
                    }

                    var finalCoords = {x: left, y: top};
                    
                    // get closest staff
                    var staff = gui.page.getClosestStaff(finalCoords);

                    var snapCoords = staff.ohSnap(finalCoords, element.currentWidth, {x: true, y: false});

                    // get vertical snap coordinates for the appropriate staff
                    switch (ele.type) {
                        case Toe.Model.Division.Type.div_small:
                            snapCoords.y = staff.zone.uly;
                            break;
                        case Toe.Model.Division.Type.div_minor:
                            snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;
                            break;
                        case Toe.Model.Division.Type.div_major:
                            snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;
                            break;
                        case Toe.Model.Division.Type.div_final:
                            snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;
                            break;
                    }

                    // remove division from the previous staff representation
                    ele.staff.removeElementByRef(ele);
                    gui.rendEng.canvas.remove(element);
                    gui.rendEng.repaint();

                    // set bounding box hint 
                    var ulx = snapCoords.x - element.currentWidth/2;
                    var uly = snapCoords.y - element.currentHeight/2;
                    var bb = [ulx, uly, ulx + element.currentWidth, uly + element.currentHeight];
                    ele.setBoundingBox(bb);

                    // get id of note to move before
                    var dInd = staff.addDivision(ele);
                    if (elements.length == 1) {
                        ele.selectDrawing();
                    }

                    var beforeid = null;
                    if (dInd + 1 < staff.elements.length) {
                        beforeid = staff.elements[dInd+1].id;
                    }
                    else {
                        // insert before the next system break staff
                        var sNextModel = gui.page.getNextStaff(staff);
                        beforeid = sNextModel.id;
                    }

                    var outbb = gui.getOutputBoundingBox([ele.zone.ulx, ele.zone.uly, ele.zone.lrx, ele.zone.lry]);
                    var data = {id: ele.id, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3], beforeid: beforeid};

                    // send move command to the server to change underlying MEI
                    $.post(gui.apiprefix + "/move/division", data)
                    .error(function() {
                        // show alert to user
                        // replace text with error message
                        $("#alert > p").text("Server failed to move division. Client and server are not synchronized.");
                        $("#alert").animate({opacity: 1.0}, 100);
                    });
                }
                else if (ele instanceof Toe.Model.Custos) {
                    var left = element.left;
                    var top = element.top;

                    // only need to reset position if part of a selection with multiple elements
                    // since single selection move disabling is handled by the lockMovementX/Y parameters.
                    if (elements.length > 1) {
                        // return the custos to the original position
                        element.left = left + delta_x;
                        element.top = top + delta_y;
                    }
                }
            });
            if (elements.length > 1) {
                gui.rendEng.canvas.discardActiveGroup();
            }
            gui.rendEng.repaint();
        }
        // we're all done moving
        gui.objMoving = false;
    });

    // Bind click handlers for the side-bar buttons
    $("#btn_delete").unbind("click");
    $("#btn_neumify").unbind("click");
    $("#btn_ungroup").unbind("click");

    $("#btn_delete").bind("click.edit", {gui: gui}, gui.handleDelete);
    $("#btn_neumify").bind("click.edit", {gui: gui}, gui.handleNeumify);
    $("#btn_neumify_liquescence").bind("click.edit", {gui: gui, modifier: "alt"}, gui.handleNeumify);
    $("#btn_ungroup").bind("click.edit", {gui: gui}, gui.handleUngroup);
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
    var outbb = gui.getOutputBoundingBox([punctum.zone.ulx, punctum.zone.uly, punctum.zone.lrx, punctum.zone.lry]);
    var args = {id: punctum.id, dotform: "aug", ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]};
    if (!hasDot) {
        // send add dot command to server to change underlying MEI
        $.post(gui.apiprefix + "/insert/dot", args)
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to add a dot to the punctum. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }
    else {
        // send remove dot command to server to change underlying MEI
        $.post(gui.apiprefix + "/delete/dot", args)
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to remove dot from the punctum. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }

    $(this).toggleClass("active");
}

Toe.View.GUI.prototype.handleHeadShapeChange = function(e) {
    var gui = e.data.gui;
    var shape = e.data.shape;
    var punctum = e.data.punctum;
    var nc = punctum.components[0];

    nc.setHeadShape(shape);

    // deal with head shapes that change the neume name
    if (shape == "virga") {
        punctum.name = "Virga";
        punctum.typeid = "virga";
    }
    else if (shape == "cavum") {
        punctum.name = "Cavum";
        punctum.typeid = "cavum";
    }

    // update drawing
    punctum.syncDrawing();

    var outbb = gui.getOutputBoundingBox([punctum.zone.ulx, punctum.zone.uly, punctum.zone.lrx, punctum.zone.lry]);
    var args = {id: punctum.id, shape: shape, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]};

    // send change head command to server to change underlying MEI
    $.post(gui.apiprefix + "/update/neume/headshape", args)
    .error(function() {
        // show alert to user
        // replace text with error message
        $("#alert > p").text("Server failed to change note head shape. Client and server are not synchronized.");
        $("#alert").animate({opacity: 1.0}, 100);
    });
}

Toe.View.GUI.prototype.handleClefShapeChange = function(e) {
    var gui = e.data.gui;
    var clef = e.data.clef;
    var cShape = e.data.shape;

    if (clef.shape != cShape) {
        clef.setShape(cShape);

        var neumesOnStaff = clef.staff.getPitchedElements({neumes: true, custos: false});
        if (neumesOnStaff.length > 0 && clef.staff.getActingClefByEle(neumesOnStaff[0]) == clef) {
            // if the shift of the clef has affected the first neume on this staff
            // update the custos on the previous staff
            var prevStaff = gui.page.getPreviousStaff(clef.staff);
            if (prevStaff) {
                var newPname = neumesOnStaff[0].components[0].pname;
                var newOct = neumesOnStaff[0].components[0].oct;
                gui.handleUpdatePrevCustos(newPname, newOct, prevStaff);
            }
        }

        var pitchInfo = $.map(clef.staff.getPitchedElements({clef: clef}), function(e) {
            if (e instanceof Toe.Model.Neume) {
                var pitchInfo = new Array();
                $.each(e.components, function(nInd, n) {
                    pitchInfo.push({pname: n.pname, oct: n.oct});
                });
                return {id: e.id, noteInfo: pitchInfo};
            }
            else if (e instanceof Toe.Model.Custos) {
                // the custos has been vertically moved
                // update the custos bounding box information in the model
                // do not need to update pitch name & octave since this does not change
                var outbb = gui.getOutputBoundingBox([e.zone.ulx, e.zone.uly, e.zone.lrx, e.zone.lry]);
                $.post(gui.apiprefix + "/move/custos", {id: e.id, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]})
                .error(function() {
                    // show alert to user
                    // replace text with error message
                    $("#alert > p").text("Server failed to move custos. Client and server are not synchronized.");
                    $("#alert").animate({opacity: 1.0}, 100);
                });
            }
        });

        var outbb = gui.getOutputBoundingBox([clef.zone.ulx, clef.zone.uly, clef.zone.lrx, clef.zone.lry]);
        var args = {id: clef.id, shape: cShape, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3], pitchInfo: pitchInfo};

        // send pitch shift command to server to change underlying MEI
        $.post(gui.apiprefix + "/update/clef/shape", {data: JSON.stringify(args)})
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to update clef shape. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });

        $(this).toggleClass("active");
    }
}

Toe.View.GUI.prototype.handleDelete = function(e) {
    var gui = e.data.gui;

    // get current canvas selection
    // check individual selection and group selections
    toDelete = {clefs: new Array(), nids: new Array(), dids: new Array(), cids: new Array()};

    var deleteClef = function(drawing) {
        var clef = drawing.eleRef;
        var staff = clef.staff;

        // get previous acting clef
        //  (NOTE: this should always be defined
        // since the first clef on a system is not allowed to be deleted)
        var pClef = staff.getPreviousClef(clef);

        // get references to pitched elements that will be changed after
        // the clef is deleted.
        var pitchedEles = staff.getPitchedElements(clef);

        // now delete the clef, and update the pitch information of these elements
        staff.removeElementByRef(clef);
        staff.updatePitchedElements(pClef);

        // gather the pitch information of the pitched notes
        var pitchInfo = $.map(pitchedEles, function(e) {
            if (e instanceof Toe.Model.Neume) {
                var pitchInfo = new Array();
                $.each(e.components, function(nInd, n) {
                    pitchInfo.push({pname: n.pname, oct: n.oct});
                });
                return {id: e.id, noteInfo: pitchInfo};
            }
            else if (e instanceof Toe.Model.Custos) {
                // the custos has been vertically moved
                // update the custos bounding box information in the model
                // do not need to update pitch name & octave since this does not change
                var outbb = gui.getOutputBoundingBox([e.zone.ulx, e.zone.uly, e.zone.lrx, e.zone.lry]);
                $.post(gui.apiprefix + "/move/custos", {id: e.id, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]})
                .error(function() {
                    // show alert to user
                    // replace text with error message
                    $("#alert > p").text("Server failed to move custos. Client and server are not synchronized.");
                    $("#alert").animate({opacity: 1.0}, 100);
                });
            }
        });

        toDelete.clefs.push({id: clef.id, pitchInfo: pitchInfo});

        gui.rendEng.canvas.remove(drawing);
        gui.rendEng.canvas.discardActiveObject();
    };

    var deleteNeume = function(drawing) {
        var neume = drawing.eleRef;

        var neumesOnStaff = neume.staff.getPitchedElements({neumes: true, custos: false});

        neume.staff.removeElementByRef(neume);
        toDelete.nids.push(neume.id);

        gui.rendEng.canvas.discardActiveObject();

        if (neumesOnStaff.length == 1) {
            // there are no neumes left on the staff
            // remove the custos from the previous staff
            var prevStaff = gui.page.getPreviousStaff(neume.staff);
            if (prevStaff && prevStaff.custos) {
                prevStaff.custos.eraseDrawing();
                prevStaff.removeElementByRef(prevStaff.custos);

                // send the custos delete command to the server to update the underlying MEI
                $.post(gui.apiprefix + "/delete/custos", {ids: prevStaff.custos.id})
                .error(function() {
                    // show alert to user
                    // replace text with error message
                    $("#alert > p").text("Server failed to delete custos. Client and server are not synchronized.");
                    $("#alert").animate({opacity: 1.0}, 100);
                });

                prevStaff.custos = null;
            }
        }
        else if (neume == neumesOnStaff[0]) {
            // if this neume is the first neume on the staff
            // update the custos of the previous staff
            var prevStaff = gui.page.getPreviousStaff(neume.staff);
            if (prevStaff && prevStaff.custos) {
                var custos = prevStaff.custos;
                var nextNeume = neumesOnStaff[1];
                var newPname = nextNeume.components[0].pname;
                var newOct = nextNeume.components[0].oct;
                
                var actingClef = prevStaff.getActingClefByEle(custos);
                var newStaffPos = prevStaff.calcStaffPosFromPitch(newPname, newOct, actingClef);

                custos.pname = newPname;
                custos.oct = newOct;
                custos.setRootStaffPos(newStaffPos);

                // the custos has been vertically moved
                // update the custos bounding box information in the model
                // do not need to update pitch name & octave since this does not change
                var outbb = gui.getOutputBoundingBox([custos.zone.ulx, custos.zone.uly, custos.zone.lrx, custos.zone.lry]);
                $.post(gui.apiprefix + "/move/custos",
                      {id: custos.id, pname: newPname, oct: newOct, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]})
                .error(function() {
                    // show alert to user
                    // replace text with error message
                    $("#alert > p").text("Server failed to move custos. Client and server are not synchronized.");
                    $("#alert").animate({opacity: 1.0}, 100);
                });
            }
        }
    };

    var deleteDivision = function(drawing) {
        var division = drawing.eleRef;

        division.staff.removeElementByRef(division);
        toDelete.dids.push(division.id);

        gui.rendEng.canvas.remove(drawing);
        gui.rendEng.canvas.discardActiveObject();
    };

    var deleteCustos = function(drawing) {
        var custos = drawing.eleRef;

        custos.staff.removeElementByRef(custos);
        custos.staff.custos = null;
        toDelete.cids.push(custos.id);

        gui.rendEng.canvas.remove(drawing);
        gui.rendEng.canvas.discardActiveObject();
    }

    var selection = gui.rendEng.canvas.getActiveObject();
    if (selection) {
        // ignore the first clef, since this should never be deleted
        if (selection.eleRef instanceof Toe.Model.Clef && selection.eleRef.staff.elements[0] != selection.eleRef) {
            deleteClef(selection);
        }
        else if (selection.eleRef instanceof Toe.Model.Neume) {
            deleteNeume(selection);
        }
        else if (selection.eleRef instanceof Toe.Model.Division) {
            deleteDivision(selection);
        }
        else if (selection.eleRef instanceof Toe.Model.Custos) {
            deleteCustos(selection);
        }

        gui.rendEng.repaint();
    }
    else {
        selection = gui.rendEng.canvas.getActiveGroup();
        if (selection) {
            // group of elements selected
            $.each(selection.getObjects(), function(oInd, o) {
                // ignore the first clef, since this should never be deleted
                if (o.eleRef instanceof Toe.Model.Clef && o.eleRef.staff.elements[0] != o.eleRef) {
                    deleteClef(o);
                }
                else if (o.eleRef instanceof Toe.Model.Neume) {
                    deleteNeume(o);
                }
                else if (o.eleRef instanceof Toe.Model.Division) {
                    deleteDivision(o);
                }
                else if (o.eleRef instanceof Toe.Model.Custos) {
                    deleteCustos(o);
                }
            });

            gui.rendEng.canvas.discardActiveGroup();
            gui.rendEng.repaint();
        }
    }

    if (toDelete.clefs.length > 0) {
        // send delete command to the server to change underlying MEI
        $.post(gui.apiprefix + "/delete/clef", {data: JSON.stringify(toDelete.clefs)})
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to delete clef. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }

    if (toDelete.nids.length > 0) {
        // send delete command to server to change underlying MEI
        $.post(gui.apiprefix + "/delete/neume",  {ids: toDelete.nids.join(",")})
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to delete neume. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }
    if (toDelete.dids.length > 0) {
        // send delete command to server to change underlying MEI
        $.post(gui.apiprefix + "/delete/division", {ids: toDelete.dids.join(",")})
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to delete division. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }
    if (toDelete.cids.length > 0) {
        // send delete command to server to change underlying MEI
        $.post(gui.apiprefix + "/delete/custos", {ids: toDelete.cids.join(",")})
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to delete custos. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }

    
}

Toe.View.GUI.prototype.handleNeumify = function(e) {
    var gui = e.data.gui;
    var modifier = e.data.modifier;

    // only need to neumify if a group of objects are selected
    var selection = gui.rendEng.canvas.getActiveGroup();
    if (selection) {
        // there is something selected
        // make sure there are at least 2 neumes on the same staff to work with
        var neumes = new Array();
        var sModel = null;
        $.each(selection.getObjects(), function (oInd, o) {
            if (o.eleRef instanceof Toe.Model.Neume) {
                if (!sModel) {
                    sModel = o.eleRef.staff;
                }

                if (o.eleRef.staff == sModel) {
                    neumes.push(o);
                }
            }
        });

        if (neumes.length < 2) {
            return;
        }

        // sort the group based on x position (why fabric doesn't do this, I don't know)
        neumes.sort(function(o1, o2) {
            return o1.eleRef.zone.ulx - o2.eleRef.zone.ulx;
        });

        // begin the NEUMIFICATION
        var newNeume = new Toe.Model.Neume({modifier: modifier});
                        
        numPunct = 0;
        var nids = new Array();
        var ulx = Number.MAX_VALUE;
        var uly = Number.MAX_VALUE;
        var lry = Number.MIN_VALUE;
        $.each(neumes, function (oInd, o) {
            var nModel = o.eleRef;

            // grab underlying notes
            $.merge(newNeume.components, o.eleRef.components);
            numPunct += o.eleRef.components.length;

            // update neume ids
            nids.push(o.eleRef.id);

            // calculate object's absolute positions from within selection group
            var left = selection.left + o.left;
            var top = selection.top + o.top;
            
            ulx = Math.min(ulx, left - o.currentHeight/2);
            uly = Math.min(uly, top - o.currentHeight/2);
            lry = Math.max(lry, top + o.currentHeight/2);

            // remove the neume, we don't need it anymore
            sModel.removeElementByRef(o.eleRef);
            gui.rendEng.canvas.remove(o);
        });
        var lrx = ulx + numPunct*gui.punctWidth;

        // set the bounding box hint of the new neume for drawing
        var bb = [ulx, uly, lrx, lry];
        newNeume.setBoundingBox(bb);

        // instantiate neume view and controller
        var nView = new Toe.View.NeumeView(gui.rendEng, gui.dwgLib);
        var nCtrl = new Toe.Ctrl.NeumeController(newNeume, nView);

        // render the new neume
        sModel.addNeume(newNeume);

        // get final bounding box information
        var outbb = gui.getOutputBoundingBox([newNeume.zone.ulx, newNeume.zone.uly, newNeume.zone.lrx, newNeume.zone.lry]);

        var typeid = newNeume.typeid;

        // get note head shapes to change in underlying mei
        var headShapes = $.map(newNeume.components, function(nc) {
            return nc.props.type;
        });

        var data = JSON.stringify({"nids": nids.join(","), "typeid": typeid, "headShapes": headShapes, "ulx": outbb[0], "uly": outbb[1], "lrx": outbb[2], "lry": outbb[3]});
        // call server neumify function to update MEI
        $.post(gui.apiprefix + "/neumify", {data: data}, function(data) {
            // set id of the new neume with generated ID from the server
            newNeume.id = JSON.parse(data).id;
        })
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to neumify selected neumes. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });

        gui.rendEng.canvas.discardActiveGroup();

        // select the new neume
        $(newNeume).trigger("vSelectDrawing");

        gui.rendEng.repaint();
    }
}

Toe.View.GUI.prototype.handleUngroup = function(e) {
    var gui = e.data.gui;

    var neumes = new Array();

    var selection = gui.rendEng.canvas.getActiveObject();
    if (selection) {
        if (selection.eleRef instanceof Toe.Model.Neume && selection.eleRef.components.length > 1) {
            neumes.push(selection);
        }
    }
    else {
        selection = gui.rendEng.canvas.getActiveGroup();
        if (selection) {
            // group of elements selected
            $.each(selection.getObjects(), function(oInd, o) {
                // only deal with neumes with that have more components than a punctum
                if (o.eleRef instanceof Toe.Model.Neume && o.eleRef.components.length > 1) {
                    neumes.push(o);
                }
            });
        }
    }

    var nids = new Array();
    var bbs = new Array();
    var punctums = new Array();

    // ungroup each selected neume
    $.each(neumes, function(oInd, o) {
        // add to list of neume ids
        nids.push(o.eleRef.id);

        var punctBoxes = new Array();
        var ulx = o.eleRef.zone.ulx;

        // remove the old neume
        o.eleRef.staff.removeElementByRef(o.eleRef);
        gui.rendEng.canvas.remove(o);

        $.each(o.eleRef.components, function(ncInd, nc) {
            var newPunct = new Toe.Model.Neume();
            newPunct.components.push(nc);

            var uly = o.eleRef.staff.zone.uly - (o.eleRef.rootStaffPos + nc.pitchDiff)*o.eleRef.staff.delta_y/2 - gui.punctHeight/2;
            // set the bounding box hint of the new neume for drawing
            var bb = [ulx+(ncInd*gui.punctWidth), uly, ulx+((ncInd+1)*gui.punctWidth), uly+gui.punctHeight];
            newPunct.setBoundingBox(bb);

            // instantiate neume view and controller
            var nView = new Toe.View.NeumeView(gui.rendEng, gui.dwgLib);
            var nCtrl = new Toe.Ctrl.NeumeController(newPunct, nView);

            // add the punctum to the staff and draw it
            o.eleRef.staff.addNeume(newPunct);

            // get final bounding box information
            var outbb = gui.getOutputBoundingBox([newPunct.zone.ulx, newPunct.zone.uly, newPunct.zone.lrx, newPunct.zone.lry]);
            punctBoxes.push({"ulx": outbb[0], "uly": outbb[1], "lrx": outbb[2], "lry": outbb[3]});

            punctums.push(newPunct);
        });

        // add to list of neume bounding boxes
        bbs.push(punctBoxes);
    });

    var data = JSON.stringify({"nids": nids.join(","), "bbs": bbs});

    // call server ungroup function to update MEI
    $.post(gui.apiprefix + "/ungroup", {data: data}, function(data) {
        // set ids of the new puncta from the IDs generated from the server
        var nids = JSON.parse(data).nids;
        // flatten array of nested nid arrays (if ungrouping more than one neume)
        nids = $.map(nids, function(n) {
            return n;
        });

        $.each(punctums, function(i, punct) {
            punct.id = nids[i];
        });
    })
    .error(function() {
        // show alert to user
        // replace text with error message
        $("#alert > p").text("Server failed to ungroup selected neumes. Client and server are not synchronized.");
        $("#alert").animate({opacity: 1.0}, 100);
    });

    gui.rendEng.canvas.discardActiveObject();
    gui.rendEng.canvas.discardActiveGroup();
    gui.rendEng.repaint();

    
}

/**************************************************
 *                  INSERT                        *
 **************************************************/
Toe.View.GUI.prototype.handleInsert = function(e) {
    var gui = e.data.gui;
    var parentDivId = e.data.parentDivId;

    // deactivate all objects on the canvas 
    // so they can't be modified in insert mode
    gui.rendEng.canvas.selection = false;
    gui.rendEng.canvas.deactivateAll();
    gui.rendEng.canvas.HOVER_CURSOR = null;

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
                              '<button id="rad_division" class="btn"><b>||</b> Division</button>\n' + 
                              '<button id="rad_clef" class="btn">Clef</button>\n</div>\n</li>\n</span>');
    }

    // update click handlers
    $("#rad_punctum").unbind("click");
    $("#rad_division").unbind("click");
    $("#rad_clef").unbind("click");

    $("#rad_punctum").bind("click.insert", {gui: gui}, gui.handleInsertPunctum);
    $("#rad_division").bind("click.insert", {gui: gui}, gui.handleInsertDivision);
    $("#rad_clef").bind("click.insert", {gui: gui}, gui.handleInsertClef);

    // toggle punctum insert by default
    $("#rad_punctum").trigger('click');
}

Toe.View.GUI.prototype.handleInsertPunctum = function(e) {
    var gui = e.data.gui;

    // unbind other event handlers
    gui.rendEng.unObserve("mouse:move");
    gui.rendEng.unObserve("mouse:up");

    // remove insert menus not for punctums
    $("#menu_insertdivision").remove();
    $("#menu_insertclef").remove();

    // remove division/clef following the punctum
    if (gui.divisionDwg) {
        gui.rendEng.canvas.remove(gui.divisionDwg);
    }
    if (gui.clefDwg) {
        gui.rendEng.canvas.remove(gui.clefDwg);
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

    // keep the scope of the punctum drawing insert local
    // to not pollute the global namespace when inserting other
    // musical elements
    var updateFollowPunct = function(initial) {
        var elements = {modify: new Array(), fixed: new Array()};

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

            /* TODO: deal with episemata
            if (hasHorizEpisema) {
            }

            if (hasVertEpisema) {
            }
            */
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
        var pnt = gui.rendEng.canvas.getPointer(e.e);
        gui.punctDwg.left = pnt.x - gui.punctDwg.currentWidth/4;
        gui.punctDwg.top = pnt.y - gui.punctDwg.currentHeight/4;

        gui.rendEng.repaint();
    });

    // deal with punctum insert
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
        var noteInfo = sModel.calcPitchFromCoords(snapCoords);
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
        
        /* TODO: deal with episemata
        if (hasHorizEpisema) {
        }
        if (hasVertEpisema) {
        }
        */

        nModel.addComponent("punctum", pname, oct, {ornaments: ornaments});

        // instantiate neume view and controller
        var nView = new Toe.View.NeumeView(gui.rendEng, gui.dwgLib);
        var nCtrl = new Toe.Ctrl.NeumeController(nModel, nView);
        
        // mount neume on the staff
        var nInd = sModel.addNeume(nModel);

        // if this is the first neume on a staff, update the custos of the next staff
        if (nInd == 1) {
            var prevStaff = gui.page.getPreviousStaff(sModel);
            if (prevStaff) {
                gui.handleUpdatePrevCustos(pname, oct, prevStaff);
            }
        }

        // now that final bounding box is calculated from the drawing
        // add the bounding box information to the server function arguments
        var outbb = gui.getOutputBoundingBox([nModel.zone.ulx, nModel.zone.uly, nModel.zone.lrx, nModel.zone.lry]);
        args["ulx"] = outbb[0];
        args["uly"] = outbb[1];
        args["lrx"] = outbb[2];
        args["lry"] = outbb[3];

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
        $.post(gui.apiprefix + "/insert/neume", args, function(data) {
            nModel.id = JSON.parse(data).id;
        })
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to insert neume. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
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

    /* TODO: insert with episemata
    $("#chk_horizepisema").bind("click.insert", function() {
        if ($(this).hasClass("active")) {
            hasHorizEpisema = true;
        }
        else {
            hasHorizEpisema = false;
        }
    });

    $("#chk_vertepisema").bind("click.insert", function() {
    });
    */
}

Toe.View.GUI.prototype.handleInsertDivision = function(e) {
    var gui = e.data.gui;

    // unbind other insert event handlers
    gui.rendEng.unObserve("mouse:move");
    gui.rendEng.unObserve("mouse:up");

    // remove the punctum/clef following the pointer
    if (gui.punctDwg) {
        gui.rendEng.canvas.remove(gui.punctDwg);
    }
    if (gui.clefDwg) {
        gui.rendEng.canvas.remove(gui.clefDwg);
    }

    // remove ornamentation UI elements - not needed for divisions
    $("#menu_insertpunctum").remove();
    $("#menu_insertclef").remove();

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
        var pnt = gui.rendEng.canvas.getPointer(e.e);

        // get closest staff
        staff = gui.page.getClosestStaff(pnt);

        var snapCoords = pnt;
        var divProps = {strokeWidth: 4, opacity: 0.6};
        switch (divisionForm) {
            case "div_small":
                snapCoords.y = staff.zone.uly;

                if (!gui.divisionDwg) {
                    var y1 = staff.zone.uly - staff.delta_y/2;
                    var y2 = staff.zone.uly + staff.delta_y/2;
                    var x1 = snapCoords.x;

                    gui.divisionDwg = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                    gui.rendEng.draw({fixed: [gui.divisionDwg], modify: []}, {selectable: false, opacity: 0.6});
                }
                break;
            case "div_minor":
                snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;

                if (!gui.divisionDwg) {
                    var y1 = staff.zone.uly + staff.delta_y/2;
                    var y2 = y1 + 2*staff.delta_y;
                    var x1 = snapCoords.x;

                    gui.divisionDwg = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                    gui.rendEng.draw({fixed: [gui.divisionDwg], modify: []}, {selectable: false, opacity: 0.6});
                }
                break;
            case "div_major":
                snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;

                if (!gui.divisionDwg) {
                    var y1 = staff.zone.uly;
                    var y2 = staff.zone.lry;
                    var x1 = snapCoords.x;

                    gui.divisionDwg = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                    gui.rendEng.draw({fixed: [gui.divisionDwg], modify: []}, {selectable: false, opacity: 0.6});
                }
                break;
            case "div_final":
                snapCoords.y = staff.zone.uly + (staff.zone.lry - staff.zone.uly)/2;

                if (!gui.divisionDwg) {
                    var y1 = staff.zone.uly;
                    var y2 = staff.zone.lry;
                    var x1 = snapCoords.x;
                    // make width equal to width of punctum glyph
                    var x2 = snapCoords.x + gui.punctWidth;

                    var div1 = gui.rendEng.createLine([x1, y1, x1, y2], divProps);
                    var div2 = gui.rendEng.createLine([x2, y1, x2, y2], divProps);
                    gui.divisionDwg = gui.rendEng.draw({fixed: [div1, div2], modify: []}, {group: true, selectable: false, opacity: 0.6})[0];
                }
                break;
        }                    

        // snap the drawing to the staff on the x-plane
        var dwgLeft = pnt.x - gui.divisionDwg.currentWidth/2;
        var dwgRight = pnt.x + gui.divisionDwg.currentWidth/2;
        if (staff.elements[0] instanceof Toe.Model.Clef && dwgLeft <= staff.elements[0].zone.lrx) {
            snapCoords.x = staff.elements[0].zone.lrx + gui.divisionDwg.currentWidth/2 + 1;
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

    // handle the actual insertion
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

        var outbb = gui.getOutputBoundingBox(bb);
        var args = {type: division.key.slice(4), ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]};
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
        $.post(gui.apiprefix + "/insert/division", args, function(data) {
            division.id = JSON.parse(data).id;
        })
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to insert division. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    });

    $("#rad_small").bind("click.insert", function() {
        // remove the current division following the pointer
        if (gui.divisionDwg) {
            gui.rendEng.canvas.remove(gui.divisionDwg);
            gui.divisionDwg = null;
        }
        divisionForm = "div_small";
    });

    $("#rad_minor").bind("click.insert", function() {
        if (gui.divisionDwg) {
            gui.rendEng.canvas.remove(gui.divisionDwg);
            gui.divisionDwg = null;
        }
        divisionForm = "div_minor";
    });

    $("#rad_major").bind("click.insert", function() {
        if (gui.divisionDwg) {
            gui.rendEng.canvas.remove(gui.divisionDwg);
            gui.divisionDwg = null;
        }
        divisionForm = "div_major";
    });

    $("#rad_final").bind("click.insert", function() {
        if (gui.divisionDwg) {
            gui.rendEng.canvas.remove(gui.divisionDwg);
            gui.divisionDwg = null;
        }
        divisionForm = "div_final";
    });

    // toggle small division by default
    $("#rad_small").trigger('click');
}

Toe.View.GUI.prototype.handleInsertClef = function(e) {
    var gui = e.data.gui;

    // unbind other insert event handlers
    gui.rendEng.unObserve("mouse:move");
    gui.rendEng.unObserve("mouse:up");

    // remove the punctum/division following the pointer
    if (gui.punctDwg) {
        gui.rendEng.canvas.remove(gui.punctDwg);
    }
    if (gui.divisionDwg) {
        gui.rendEng.canvas.remove(gui.divisionDwg);
    }

    // remove insert menus not for clefs
    $("#menu_insertpunctum").remove();
    $("#menu_insertdivision").remove();

    // add clef type toggles
    if ($("#menu_insertclef").length == 0) {
        $("#sidebar-insert").append('<span id="menu_insertclef"><br/>\n<li class="nav-header">Clef Type</li>\n' +
                                    '<li><div class="btn-group" data-toggle="buttons-radio">\n' +
                                    '<button id="rad_doh" class="btn">C</button>\n' +
                                    '<button id="rad_fah" class="btn">F</button>\n' +
                                    '</div>\n</li>\n</span>');
    }

    // current clef shape being inserted.
    var cShape = null;

    // move the drawing with the pointer
    gui.rendEng.canvas.observe("mouse:move", function(e) {
        var pnt = gui.rendEng.canvas.getPointer(e.e);

        var xOffset = 0;
        var yOffset = 0;
        // calculate pointer offset
        // are mostly magic numbers to make the interface look pretty
        // but these are relative scalings to the glyph size so it will
        // work for all global scalings.
        if (cShape == "c") {
            xOffset = gui.clefDwg.currentWidth/4;
        }
        else {
            xOffset = gui.clefDwg.currentWidth/8;
            yOffset = gui.clefDwg.currentHeight/8;
        }
        gui.clefDwg.left = pnt.x - xOffset;
        gui.clefDwg.top = pnt.y + yOffset;

        gui.rendEng.repaint();
    });

    // handle the actual insertion
    gui.rendEng.canvas.observe("mouse:up", function(e) {
        // get coords
        var coords = {x: gui.clefDwg.left, y: gui.clefDwg.top};

        if (cShape == "f") {
            coords.x -= gui.clefDwg.currentWidth/8;
            coords.y -= gui.clefDwg.currentHeight/8;
        }

        // get closest staff to insert onto
        var staff = gui.page.getClosestStaff(coords);

        // calculate snapped coordinates on the staff
        var snapCoords = staff.ohSnap(coords, gui.clefDwg.currentWidth);

        var staffPos = Math.round((staff.zone.uly - snapCoords.y) / (staff.delta_y/2));

        var clef = new Toe.Model.Clef(cShape, {"staffPos": staffPos});

        // update bounding box with physical position on page
        var ulx = snapCoords.x - gui.clefDwg.currentWidth/2;
        var uly = snapCoords.y - gui.clefDwg.currentHeight/2;
        var bb = [ulx, uly, ulx + gui.clefDwg.currentWidth, uly + gui.clefDwg.currentHeight];
        clef.setBoundingBox(bb);

        // instantiate clef view and controller
        var cView = new Toe.View.ClefView(gui.rendEng);
        var cCtrl = new Toe.Ctrl.ClefController(clef, cView);

        // mount clef on the staff
        var nInd = staff.addClef(clef);

        var staffLine = staff.props.numLines + staffPos/2;
        var outbb = gui.getOutputBoundingBox([clef.zone.ulx, clef.zone.uly, clef.zone.lrx, clef.zone.lry]);
        var args = {shape: cShape, line: staffLine, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]};
        // get next element to insert before
        if (nInd + 1 < staff.elements.length) {
            args["beforeid"] = staff.elements[nInd+1].id;
        }
        else {
            // insert before the next system break
            var sNextModel = gui.page.getNextStaff(staff);
            args["beforeid"] = sNextModel.id;
        }

        var neumesOnStaff = staff.getPitchedElements({neumes: true, custos: false});
        if (neumesOnStaff.length > 0 && staff.getActingClefByEle(neumesOnStaff[0]) == clef) {
            // if the shift of the clef has affected the first neume on this staff
            // update the custos on the previous staff
            var prevStaff = gui.page.getPreviousStaff(staff);
            if (prevStaff) {
                var newPname = neumesOnStaff[0].components[0].pname;
                var newOct = neumesOnStaff[0].components[0].oct;
                gui.handleUpdatePrevCustos(newPname, newOct, prevStaff);
            }
        }

        // gather new pitch information of affected pitched elements
        args["pitchInfo"] = $.map(staff.getPitchedElements({clef: clef}), function(e) {
            if (e instanceof Toe.Model.Neume) {
                var pitchInfo = new Array();
                $.each(e.components, function(nInd, n) {
                    pitchInfo.push({pname: n.pname, oct: n.oct});
                });
                return {id: e.id, noteInfo: pitchInfo};
            }
            else if (e instanceof Toe.Model.Custos) {
                // the custos has been vertically moved
                // update the custos bounding box information in the model
                // do not need to update pitch name & octave since this does not change
                var outbb = gui.getOutputBoundingBox([e.zone.ulx, e.zone.uly, e.zone.lrx, e.zone.lry]);
                $.post(gui.apiprefix + "/move/custos", {id: e.id, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]})
                .error(function() {
                    // show alert to user
                    // replace text with error message
                    $("#alert > p").text("Server failed to move custos. Client and server are not synchronized.");
                    $("#alert").animate({opacity: 1.0}, 100);
                });
            }
        });

        // send insert clef command to the server to change underlying MEI
        $.post(gui.apiprefix + "/insert/clef", {data: JSON.stringify(args)}, function(data) {
            clef.id = JSON.parse(data).id;
        })
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to insert clef. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    });

    // release old bindings
    $("#rad_doh").unbind("click");
    $("#rad_fah").unbind("click");

    $("#rad_doh").bind("click.insert", function() {
        // only need to update following drawing if the clef
        // shape is different
        if (!$(this).hasClass("active")) {
            // initially set clefshape of the screen
            var cPos = {left: -50, top: -50};
            if (gui.clefDwg) {
                gui.rendEng.canvas.remove(gui.clefDwg);
                // draw the new clef at the old clef's location
                cPos = {left: gui.clefDwg.left, top: gui.clefDwg.top};
            }

            var cGlyph = gui.rendEng.getGlyph("c_clef");
            var clef = cGlyph.clone().set($.extend(cPos, {opacity: 0.6}));
            gui.clefDwg = gui.rendEng.draw({fixed: [], modify: [clef]}, {opacity: 0.6, selectable: false, repaint: true})[0];

            cShape = "c";
        }
    });

    $("#rad_fah").bind("click.insert", function() {
        // only need to update following drawing if the clef
        // shape is different
        if (!$(this).hasClass("active")) {
            // initially set clefshape of the screen
            var cPos = {left: -50, top: -50};
            if (gui.clefDwg) {
                gui.rendEng.canvas.remove(gui.clefDwg);
                // draw the new clef at the old clef's location
                cPos = {left: gui.clefDwg.left, top: gui.clefDwg.top};
            }

            var cGlyph = gui.rendEng.getGlyph("f_clef");
            var clef = cGlyph.clone().set($.extend(cPos, {opacity: 0.6}));
            gui.clefDwg = gui.rendEng.draw({fixed: [], modify: [clef]}, {opacity: 0.6, selectable: false, repaint: true})[0];

            cShape = "f";
        }
    });

    // toggle doh clef by default
    $("#rad_doh").trigger("click");
}

Toe.View.GUI.prototype.handleUpdatePrevCustos = function(pname, oct, prevStaff) {
    var custos = prevStaff.custos;
    if (custos) {
        // update the custos
        custos.setRootNote(pname, oct);
        
        // get acting clef for the custos 
        var actingClef = prevStaff.getActingClefByEle(custos);
        custos.setRootStaffPos(prevStaff.calcStaffPosFromPitch(pname, oct, actingClef));
        var outbb = this.getOutputBoundingBox([custos.zone.ulx, custos.zone.uly, custos.zone.lrx, custos.zone.lry]);
        $.post(this.apiprefix + "/move/custos", {id: custos.id, pname: pname, oct: oct, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]})
        .error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to move custos. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }
    else {
        // insert a custos
        var cModel = new Toe.Model.Custos(pname, oct);

        // create bounding box hint
        var ulx = prevStaff.zone.lrx - gui.punctWidth/2;
        var uly = prevStaff.zone.uly; // probably not correct, but sufficient for the hint
        var bb = [ulx, uly, ulx + gui.punctWidth, uly + gui.punctHeight];
        cModel.setBoundingBox(bb);

        // instantiate custos view and controller
        var cView = new Toe.View.CustosView(gui.rendEng);
        var cCtrl = new Toe.Ctrl.CustosController(cModel, cView);

        // mount the custos on the staff
        prevStaff.setCustos(cModel);

        var outbb = this.getOutputBoundingBox([cModel.zone.ulx, cModel.zone.uly, cModel.zone.lrx, cModel.zone.lry]);
        var args = {id: cModel.id, pname: pname, oct: oct, ulx: outbb[0], uly: outbb[1], lrx: outbb[2], lry: outbb[3]};

        // get id of the next staff element
        var nextStaff = gui.page.getNextStaff(prevStaff);
        if (nextStaff) {
            args["beforeid"] = nextStaff.id;
        }

        // update underlying MEI file
        $.post(this.apiprefix + "/insert/custos", args, function(data) {
            cModel.id = JSON.parse(data).id;
        }).error(function() {
            // show alert to user
            // replace text with error message
            $("#alert > p").text("Server failed to insert custos. Client and server are not synchronized.");
            $("#alert").animate({opacity: 1.0}, 100);
        });
    }
}

Toe.View.GUI.prototype.getOutputBoundingBox = function(bb) {
    gui = this;
    return $.map(bb, function(b) {
        return Math.round(b/gui.page.scale);
    });
}
