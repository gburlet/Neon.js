(function() {
    module("Clef");
  
    // <zone lry="331" lrx="208" xml:id="m-5ff17ad0-6396-4f4b-9c99-de55e140ee97" uly="278" ulx="190"/>
    var clef_bb = [190, 278, 208, 331];
    // <zone xml:id="m-0ac66c2a-bebd-493a-94bc-cfa2a0ba0489" lry="406" lrx="1450" uly="302" ulx="190"/>
    var staff_bb = [190, 302, 406, 1450];
    // <zone lry="349" lrx="258" xml:id="m-df35aa9a-9155-4c89-a8b2-a05688156807" uly="328" ulx="240"/>
    var neume1_bb = [240, 328, 258, 349];
    // <zone lry="376" lrx="315" xml:id="m-b06676a3-4aa1-430d-b1c8-3d3fcf606f0e" uly="326" ulx="265"/>
    var neume2_bb = [265, 326, 315, 376];

    test("Constructor", function() {
        var cClefModel = new Toe.Model.Clef("c");
        var fClefModel = new Toe.Model.Clef("f");

        equal(cClefModel.shape, "c");
        equal(cClefModel.name, "Doh Clef");
        equal(fClefModel.shape, "f");
        equal(fClefModel.name, "Fah Clef");

        deepEqual(cClefModel.zone, {});
        equal(cClefModel.staff, null);

        // check default staff line has been set correctly
        equal(cClefModel.props.staffPos, 0);
        equal(fClefModel.props.staffPos, 2);

        // test default properties
        ok(cClefModel.props.interact);

        // test invalid clef shape
        raises(function() {
            new Toe.Model.Clef("z");
        });

        // test manual settings
        cClefModel = new Toe.Model.Clef("c", {staffPos: 3, interact: false});
        equal(cClefModel.props.staffPos, 3);
        ok(!cClefModel.props.interact);
    });
    
    test("Set ID", function() {
        var cClefModel = new Toe.Model.Clef("c");
        cClefModel.setID(4);

        equal(cClefModel.id, 4);
    });

    test("Set Staff", function() {
        var cClefModel = new Toe.Model.Clef("c");

        // get staff data
        var sModel = new Toe.Model.Staff(staff_bb);

        cClefModel.setStaff(sModel);

        equal(cClefModel.staff, sModel);

        // test object is not a staff
        raises(function() {
            cClefModel.setStaff(new Object());
        });
    });

    test("Set Shape", function() {
        var cClefModel = new Toe.Model.Clef("c");
        cClefModel.setBoundingBox(clef_bb);

        var sModel = new Toe.Model.Staff(staff_bb);
        sModel.addClef(cClefModel, {justPush: true});

        // add two test neumes to the staff this clef is on
        var n1 = new Toe.Model.Neume();
        n1.setBoundingBox(neume1_bb);
        n1.addComponent("punctum", "a", 3);

        var n2 = new Toe.Model.Neume();
        n2.setBoundingBox(neume2_bb);
        n2.addComponent("punctum", "a", 3);
        n2.addComponent("punctum", "g", 3);
        n2.addComponent("punctum", "a", 3);

        sModel.addNeume(n1, {justPush: true});
        sModel.addNeume(n2, {justPush: true});

        equal(sModel.elements[1].rootStaffPos, -2);
        equal(sModel.elements[1].components[0].pname, "a");
        equal(sModel.elements[1].components[0].oct, 3);
        
        equal(sModel.elements[2].rootStaffPos, -2);
        equal(sModel.elements[2].components[0].pname, "a");
        equal(sModel.elements[2].components[0].oct, 3);
        equal(sModel.elements[2].components[1].pname, "g");
        equal(sModel.elements[2].components[0].oct, 3);
        equal(sModel.elements[2].components[2].pname, "a");
        equal(sModel.elements[2].components[0].oct, 3);

        cClefModel.setShape("f");

        equal(cClefModel.shape, "f");
        equal(cClefModel.name, "Fah Clef");

        // test pitch shift of elements
        equal(sModel.elements[1].rootStaffPos, -2);
        equal(sModel.elements[1].components[0].pname, "d");
        equal(sModel.elements[1].components[0].oct, 3);

        equal(sModel.elements[2].rootStaffPos, -2);
        equal(sModel.elements[2].components[0].pname, "d");
        equal(sModel.elements[1].components[0].oct, 3);
        equal(sModel.elements[2].components[1].pname, "c");
        equal(sModel.elements[1].components[0].oct, 3);
        equal(sModel.elements[2].components[2].pname, "d");
        equal(sModel.elements[1].components[0].oct, 3);

        // test invalid clef shape
        raises(function() {
            cClef.Model.setShape("z");
        });
    });

    test("Set Bounding Box", function() {
        var cClefModel = new Toe.Model.Clef("c");

        // test invalid bounding box argument
        raises(function() { 
            cClefModel.setBoundingBox([-100,0,-200,0]);
        });

        cClefModel.setBoundingBox(clef_bb);

        equal(cClefModel.zone.ulx, clef_bb[0]);
        equal(cClefModel.zone.uly, clef_bb[1]);
        equal(cClefModel.zone.lrx, clef_bb[2]);
        equal(cClefModel.zone.lry, clef_bb[3]);

        // test float truncation
        float_bb = $.map(clef_bb, function(el) { return el + 0.243; });
        cClefModel.setBoundingBox(float_bb);

        equal(cClefModel.zone.ulx, clef_bb[0]);
        equal(cClefModel.zone.uly, clef_bb[1]);
        equal(cClefModel.zone.lrx, clef_bb[2]);
        equal(cClefModel.zone.lry, clef_bb[3]);
    });
    
    test("Set Staff Position", function() {
        var cClefModel = new Toe.Model.Clef("c", {staffPos: 0});
        cClefModel.setBoundingBox(clef_bb);

        var sModel = new Toe.Model.Staff(staff_bb);
        sModel.addClef(cClefModel, {justPush: true});

        // add two test neumes to the staff this clef is on
        var n1 = new Toe.Model.Neume();
        n1.setBoundingBox(neume1_bb);
        n1.addComponent("punctum", "a", 3);

        var n2 = new Toe.Model.Neume();
        n2.setBoundingBox(neume2_bb);
        n2.addComponent("punctum", "a", 3);
        n2.addComponent("punctum", "g", 3);
        n2.addComponent("punctum", "a", 3);

        sModel.addNeume(n1, {justPush: true});
        sModel.addNeume(n2, {justPush: true});

        equal(sModel.elements[1].rootStaffPos, -2);
        equal(sModel.elements[1].components[0].pname, "a");
        equal(sModel.elements[1].components[0].oct, 3);
        
        equal(sModel.elements[2].rootStaffPos, -2);
        equal(sModel.elements[2].components[0].pname, "a");
        equal(sModel.elements[2].components[0].oct, 3);
        equal(sModel.elements[2].components[1].pname, "g");
        equal(sModel.elements[2].components[0].oct, 3);
        equal(sModel.elements[2].components[2].pname, "a");
        equal(sModel.elements[2].components[0].oct, 3);

        cClefModel.setStaffPosition(-4);
        equal(cClefModel.props.staffPos, -4);

        // test pitch shift of elements
        equal(sModel.elements[1].rootStaffPos, -2);
        equal(sModel.elements[1].components[0].pname, "e");
        equal(sModel.elements[1].components[0].oct, 4);

        equal(sModel.elements[2].rootStaffPos, -2);
        equal(sModel.elements[2].components[0].pname, "e");
        equal(sModel.elements[1].components[0].oct, 4);
        equal(sModel.elements[2].components[1].pname, "d");
        equal(sModel.elements[1].components[0].oct, 4);
        equal(sModel.elements[2].components[2].pname, "e");
        equal(sModel.elements[1].components[0].oct, 4);
    });

})();
