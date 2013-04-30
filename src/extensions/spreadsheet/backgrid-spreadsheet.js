/*
  backgrid-spreadsheet
  http://github.com/wehaveweneed/backgrid
*/

(function ($, _, key, Backbone, Backgrid) {

    "use strict";

    Backgrid.Cell.prototype.events = {
        "click": "clickEvent"
    };

    Backgrid.Cell.prototype.clickEvent = function (event) {
       if (this.isSelected()) {
           this.enterEditMode();
       } else if (!this.isSelected()) {
           this.setSelected();
       }
    };

    Backgrid.Cell.prototype.isSelected = function () {
        return this.$el.hasClass("backgrid-selected");
    };

    Backgrid.Cell.prototype.setSelected = function () {
        $(".backgrid-selected:visible").removeClass("backgrid-selected");
        this.$el.addClass("backgrid-selected");
    };

    Backgrid.Command.prototype.moveUp = function () { return false };
    Backgrid.Command.prototype.moveDown = function () { return false };
    Backgrid.Command.prototype.moveLeft = function () { return false };
    Backgrid.Command.prototype.moveRight = function () { return false };
    Backgrid.Command.prototype.passThru = function () { return false };

    /**
       Spreadsheet extends the Body element, giving it spreadsheet like functionality

       @class Backgrid.Extension.Spreadsheet
    */

    /**
       Spreadsheet is mainly an extension of Backgrid.Grid though it also
       modifies attributes of Backgrid.Cell, most importantly, rebinds the cell
       events.
     */
    Backgrid.Extension.Spreadsheet = Backgrid.Grid.extend({

        className: "backgrid",
        events: {
            "click td": "updateCursor",
            "focus input[type=checkbox]": function (e) {
                $(e.target).blur();
            }
        },

        /**
           Initializer.

           Calls initializer code from Backgrid.Body, then executes the necessary
           initializer code for Spreadsheet.
        */
        initialize: function (options) {
            this.constructor.__super__.initialize.apply(this, [options]);
            // Generating uuid for this spreadsheet. Used as an identifier when
            // there are multiple spreadsheets.
            this.uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });

            if (options.keyboardShortcuts) {
                this.takeKeyboardControls();
            }

            if (typeof key === undefined || key == null) {
                throw Error("Keymaster not found! Please install Keymaster at https://github.com/madrobby/keymaster");
            } else {
                // This is our cursor
                this.cursor = new Cursor({ body: this.body, grid: this });
                this.bindSpreadsheetEvents();
            }

            $(document).on("spreadsheet:cursor:update", function(e, arr) {
            });
            this.listenTo(this.collection, "add", function () { this.maxRows = this.maxRows + 1 });
            this.listenTo(this.collection, "remove", function () { this.maxRows = this.maxRows - 1 });
        },

        bindSpreadsheetEvents: function () {
            var self = this;
            
            key('up', this.uuid, function(e) {
                self.cursor.move({ x: 0, y: -1 });
            });

            key('down', this.uuid, function(e) {
                self.cursor.move({ x: 0, y: 1 });
            });

            key("left", this.uuid, function(e) {
                self.cursor.move({ x: -1, y: 0 });
            });

            key("right", this.uuid, function(e) {
                self.cursor.move({ x: 1, y: 0 });
            });
            key("enter", this.uuid, function(e) {
                self.cursor.getCell().enterEditMode();
            });
            key("shift+tab", this.uuid, function(e) {
                e.preventDefault();
                if(self.cursor.getCell().$el.hasClass("editor")) {
                    self.cursor.move({ x: -1, y: 0 }).enterEditMode();
                } else {
                    self.cursor.move({ x: -1, y: 0 });
                }
                return false;
            });
            key("tab", this.uuid, function(e) {
                e.preventDefault();
                if(self.cursor.getCell().$el.hasClass("editor")) {
                    self.cursor.move({ x: 1, y: 0 }).enterEditMode();
                } else {
                    self.cursor.move({ x: 1, y: 0 });
                }
                return false;
            });

            key.filter = function (event) {
                var tagName = (event.target || event.srcElement).tagName;
                if (tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'TEXTAREA') {
                    if (event.keyCode == 9) {
                        return true;
                    }
                    return false;
                } else {
                    return true;
                }
            }
        },

        takeKeyboardControls: function() {
            key.setScope(this.uuid);
        },

        updateCursor: function () {
            var columns = this.body.columns.length;
            var rows = this.body.collection.length;
            var cell_els = this.body.$el.find("td:visible");
            var cell_index = 0;
            var self = this;
            _.every(cell_els, function(cell) {
                if($(cell).hasClass("backgrid-selected")) {
                    var newX = cell_index % columns - 1;
                    var newY = Math.floor(cell_index / columns);
                    self.cursor.moveTo({ x: newX, y: newY });
                    return false;
                }
                cell_index++;
                return true;
            });
        }
    })

    var Cursor = Backgrid.Extension.Spreadsheet.Cursor = function(options) {
        this.body = options.body || null;
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.enabled = true;
        this.initialize(options);
    };

    _.extend(Cursor.prototype, {
        /**
           Conduct initialization step.
           Creates a convenience body element wrapped in jQuery
        */
        initialize: function (options) {
            this.$body = $(this.body);
        },
        /**
           Basic movement based on a +1 on y is down, +1 on x is right. Takes a
           delta object that can optionall define and 'x' (and|or) a 'y'.
        */
        move: function (delta) {
            var upperBoundX = this.body.columns.length - 2;
            var upperBoundY = this.body.collection.length - 1;
            if (delta.hasOwnProperty('x')) {
                var newX = this.x + delta.x;
                if (newX > upperBoundX || newX == -1) {
                    throw Error("Can't move cursor in that direction.");
                }
                this.x = this.x + delta.x;
            }
            if (delta.hasOwnProperty('y')) {
                var newY = this.y + delta.y;
                if (newY > upperBoundY || newY == -1) {
                    throw Error("Can't move cursor in that direction.");
                }
                this.y = newY;
            }
            this.getCell().setSelected();
            return this.getCell();
        },
        /**
            Move directly to a coordinate. Takes a coord
            object that needs to define both 'x' and 'y'.
        */
        moveTo: function (coord) {
            if (coord.hasOwnProperty('x')) {
                this.x = coord.x;
            }
            if (coord.hasOwnProperty('y')) {
                this.y = coord.y;
            }
            return { x: this.x, y: this.y }
        },
        /**
            Get the Backgrid.Cell object that the cursor is
            currently on.
        */
        getCell: function () {
            var row = this.body.rows[this.y];
            if (row === undefined || row == null) {
                throw Error("Row not found. The cursor probably is probably in an " +
                            "invalid state Expecting: (" + this.x + ", " + this.y + ").");
            }
            var cell = row.cells[this.x + 1];
            return cell;
        }
    });


}(jQuery, _, key, Backbone, Backgrid));
