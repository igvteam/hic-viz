/**
 * Created by jrobinso on 2/7/17.
 */
/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016-2017 James Robinson
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNJuicebox web demo appECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


var hic = (function (hic) {


    dragThreshold = 2;

    hic.ContactMatrixView = function (browser) {

        var w,
            h,
            $x_axis_scrollbar_container,
            $y_axis_scrollbar_container;

        this.browser = browser;

        this.$viewport = $('<div class="hic-viewport">');

        //content canvas
        this.$canvas = $('<canvas>');
        w = this.$viewport.width();
        h = this.$viewport.height();
        this.$canvas.attr('width', w);
        this.$canvas.attr('height', h);
        this.ctx = this.$canvas.get(0).getContext("2d");

        //spinner
        this.$spinner = $('<div class="hic-viewport-spinner">');
        this.$spinner.append($('<i class="fa fa-spinner fa-spin fa-fw">'));
        this.stopSpinner();

        this.$viewport.append(this.$canvas);
        this.$viewport.append(this.$spinner);

        addMouseHandlers.call(this, this.$viewport);

        this.$viewport_container = $('<div class="hic-viewport-container">');
        this.$viewport_container.append(this.$viewport);

        this.scrollbarWidget = new hic.ScrollbarWidget(browser);
        this.$viewport_container.append(this.scrollbarWidget.$x_axis_scrollbar_container);
        this.$viewport_container.append(this.scrollbarWidget.$y_axis_scrollbar_container);

        hic.GlobalEventBus.subscribe("LocusChange", this);
        hic.GlobalEventBus.subscribe("DataLoad", this);

        this.matrixCache = {};
        this.blockCache = {};
        this.imageTileCache = {};

        this.colorScale = new igv.GradientColorScale(
            {
                low: 0,
                lowR: 255,
                lowG: 255,
                lowB: 255,
                high: 2000,
                highR: 255,
                highG: 0,
                highB: 0
            }
        );


    };

    hic.ContactMatrixView.prototype.clearCaches = function() {
        this.matrixCache = {};
        this.blockCache = {};
        this.imageTileCache = {};
    }

    hic.ContactMatrixView.prototype.getViewDimensions = function () {
        return {
            width: this.$viewport.width(),
            height: this.$viewport.height()
        }
    }

    hic.ContactMatrixView.prototype.receiveEvent = function (event) {
        // Perhaps in the future we'll do something special based on event type & properties
        this.update();

    }

    hic.ContactMatrixView.prototype.update = function () {

        if (!this.browser.hicReader) return;

        var self = this,
            state = this.browser.state;


        self.updating = true;

        this.getMatrix(state.chr1, state.chr2)
            .then(function (matrix) {

                var widthInBins = self.$viewport.width() / state.pixelSize,
                    heightInBins = self.$viewport.height() / state.pixelSize,
                    zd = matrix.bpZoomData[state.zoom],
                    blockBinCount = zd.blockBinCount,
                    blockColumnCount = zd.blockColumnCount,
                    col1 = Math.floor(state.x / blockBinCount),
                    col2 = Math.ceil((state.x + widthInBins) / blockBinCount),
                    row1 = Math.floor(state.y / blockBinCount),
                    row2 = Math.ceil((state.y + heightInBins) / blockBinCount),
                    r, c, i, b,
                    promises = [];

                for (r = row1; r <= row2; r++) {
                    for (c = col1; c <= col2; c++) {
                        b = r * blockColumnCount + c;
                        if (b >= 0) {
                            promises.push(self.getImageTile(zd, b));
                        }
                    }
                }

                Promise.all(promises).then(function (imageTiles) {
                    self.stopSpinner();
                    self.draw(imageTiles, zd);
                    self.updating = false;
                }).catch(function (error) {
                    self.stopSpinner(self);
                    self.updating = false;
                    console.error(error);
                })
            })
            .catch(function (error) {
                self.stopSpinner(self);
                self.updating = false;
                console.error(error);
            })
    };

    hic.ContactMatrixView.prototype.draw = function (imageTiles, zd) {

        var self = this,
            state = this.browser.state,
            blockBinCount = zd.blockBinCount,
            blockColumnCount = zd.blockColumnCount;

        self.$canvas.attr('width', self.$viewport.width());
        self.$canvas.attr('height', self.$viewport.height());
        imageTiles.forEach(function (imageTile) {

            var blockNumber = imageTile.blockNumber,
                image = imageTile.image;

            if (image != null) {
                var row = Math.floor(blockNumber / blockColumnCount),
                    col = blockNumber - row * blockColumnCount,
                    x0 = blockBinCount * col,
                    y0 = blockBinCount * row;

                var offsetX = x0 - state.x;
                var offsetY = y0 - state.y;
                self.ctx.drawImage(image, offsetX, offsetY);
            }
        })

    };

    hic.ContactMatrixView.prototype.getMatrix = function (chr1, chr2) {

        var self = this,
            reader = this.browser.hicReader,
            key = "" + chr1 + "_" + chr2;
        if (this.matrixCache.hasOwnProperty(key)) {
            return Promise.resolve(self.matrixCache[key]);
        } else {
            return new Promise(function (fulfill, reject) {
                self.startSpinner();
                reader
                    .readMatrix(key)
                    .then(function (matrix) {
                        self.matrixCache[key] = matrix;
                        fulfill(matrix);
                    })
                    .catch(reject);
            })

        }
    };

    hic.ContactMatrixView.prototype.getImageTile = function (zd, blockNumber) {

        var self = this,
            key = "" + zd.chr1.name + "_" + zd.chr2.name + "_" + zd.zoom.binSize + "_" + zd.zoom.unit + "_" + blockNumber;

        if (this.imageTileCache.hasOwnProperty(key)) {
            return Promise.resolve(this.imageTileCache[key]);
        } else {
            return new Promise(function (fulfill, reject) {

                var state = self.browser.state,
                    blockBinCount = zd.blockBinCount,
                    blockColumnCount = zd.blockColumnCount,
                    widthInBins = zd.blockBinCount,
                    imageSize = widthInBins * state.pixelSize;


                function drawBlock(block) {
                    var blockNumber, row, col, x0, y0, image, ctx;
                    blockNumber = block.blockNumber;
                    row = Math.floor(blockNumber / blockColumnCount);
                    col = blockNumber - row * blockColumnCount;
                    x0 = blockBinCount * row;
                    y0 = blockBinCount * col;

                    image = document.createElement('canvas');
                    image.width = imageSize;
                    image.height = imageSize;
                    ctx = image.getContext('2d');

                    // Draw the image
                    var i, rec, x, y, rgb;
                    for (i = 0; i < block.records.length; i++) {
                        rec = block.records[i];
                        x = (rec.bin1 - x0) * state.pixelSize;
                        y = (rec.bin2 - y0) * state.pixelSize;
                        rgb = self.colorScale.getColor(rec.counts);

                        ctx.fillStyle = rgb;
                        ctx.fillRect(x, y, state.pixelSize, state.pixelSize);
                        ctx.fillRect(y, x, state.pixelSize, state.pixelSize);
                    }
                    return image;
                }

                self.getBlock(zd, blockNumber)

                    .then(function (block) {

                        var image;
                        if (block) {
                            image = drawBlock(block);
                        }

                        var imageTile = {blockNumber: blockNumber, image: image};
                        self.imageTileCache[key] = imageTile;
                        fulfill(imageTile);

                    })
                    .catch(reject)
            })
        }
    };
    hic.ContactMatrixView.prototype.getBlock = function (zd, blockNumber) {

        var self = this,
            key = "" + zd.chr1.name + "_" + zd.chr2.name + "_" + zd.zoom.binSize + "_" + zd.zoom.unit + "_" + blockNumber;

        if (this.blockCache.hasOwnProperty(key)) {
            return Promise.resolve(this.blockCache[key]);
        } else {
            return new Promise(function (fulfill, reject) {

                var reader = self.browser.hicReader,
                    state = self.browser.state,
                    blockBinCount = zd.blockBinCount,
                    blockColumnCount = zd.blockColumnCount,
                    widthInBins = zd.blockBinCount,
                    imageSize = widthInBins * state.pixelSize;

                self.startSpinner();

                reader.readBlock(blockNumber, zd)
                    .then(function (block) {

                        self.blockCache[key] = block

                        self.stopSpinner();

                        fulfill(block);

                    })
                    .catch(reject)
            })
        }
    };

    hic.ContactMatrixView.prototype.startSpinner = function () {
        var $spinner = this.$spinner;
        $spinner.addClass("fa-spin");
        $spinner.show();
    };

    hic.ContactMatrixView.prototype.stopSpinner = function () {
        var $spinner = this.$spinner;
        $spinner.hide();
        $spinner.removeClass("fa-spin");
    };

    function addMouseHandlers($viewport) {

        var self = this,
            viewport = $viewport[0],
            isMouseDown = false,
            isDragging = false,
            lastMouseX,
            lastMouseY,
            mouseDownX,
            mouseDownY;

        $viewport.on('mousedown', function (e) {

            var coords;

            isMouseDown = true;
            coords = translateMouseCoordinates(e, $viewport);
            mouseDownX = lastMouseX = coords.x;
            mouseDownY = lastMouseY = coords.y;

        });

        // Guide line is bound within track area, and offset by 5 pixels so as not to interfere mouse clicks.
        // $(trackContainerDiv).mousemove(function (e) {
        //     var xy,
        //         _left,
        //         $element = igv.browser.$cursorTrackingGuide;
        //
        //     e.preventDefault();
        //
        //     xy = igv.translateMouseCoordinates(e, trackContainerDiv);
        //     _left = Math.max(50, xy.x - 5);
        //
        //     _left = Math.min(igv.browser.trackContainerDiv.width() - 65, _left);
        //     $element.css({left: _left + 'px'});
        // });

        $viewport.on('mousemove', hic.throttle(function (e) {

            var coords,
                maxEnd,
                maxStart;

            if (self.updating) return;

            e.preventDefault();

            coords = translateMouseCoordinates(e, $viewport);

            if (isMouseDown) { // Possibly dragging

                if (mouseDownX && Math.abs(coords.x - mouseDownX) > dragThreshold) {

                    isDragging = true;

                    if (self.updating) return;   // Freeze frame during updates

                    self.browser.shiftPixels(lastMouseX - coords.x, lastMouseY - coords.y);

                }

                lastMouseX = coords.x;
                lastMouseY = coords.y;
            }

        }, 10));

        $viewport.on('mouseup', mouseUpOrOut);

        $viewport.on('mouseleave', mouseUpOrOut);

        function mouseUpOrOut(e) {

            //
            // // Don't let vertical line interfere with dragging
            // if (igv.browser.$cursorTrackingGuide && e.toElement === igv.browser.$cursorTrackingGuide.get(0) && e.type === 'mouseleave') {
            //     return;
            // }

            if (isDragging) {
                isDragging = false;
                hic.GlobalEventBus.post(new hic.DragStoppedEvent());
            }

            isMouseDown = false;
            mouseDownX = lastMouseX = undefined;
            mouseDownY = lastMouseY = undefined;

        }

    }

    function translateMouseCoordinates(e, $target) {

        var eFixed,
            posx,
            posy;

        // Sets pageX and pageY for browsers that don't support them
        eFixed = $.event.fix(e);

        if (undefined === $target.offset()) {
            console.log('igv.translateMouseCoordinates - $target.offset() is undefined.');
        }
        posx = eFixed.pageX - $target.offset().left;
        posy = eFixed.pageY - $target.offset().top;

        return {x: posx, y: posy}
    }

    return hic;

})
(hic || {});
