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
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


var hic = (function (hic) {

    var defaultPixelSize = 2,
        defaultState = new hic.State(1, 1, 1, 0, 0, defaultPixelSize);

    hic.createBrowser = function ($hic_container, config) {
        return new hic.Browser($hic_container, config);
    };

    hic.Browser = function ($app_container, config) {

        var $root,
            $content_container;

        this.config = config;

        $root = $('<div class="hic-root unselect">');
        $app_container.append($root);

        // navbar
        this.$navbar_container = $('<div class="hic-navbar-container">');
        $root.append(this.$navbar_container);

        // logo
        this.$navbar_container.append($('<div class="hic-logo-container">'));

        $content_container = $('<div class="hic-content-container">');
        $root.append($content_container);

        this.$xAxis = xAxis();
        $content_container.append(this.$xAxis);
        this.xAxisRuler = new hic.Ruler(this, this.$xAxis.find('.hic-x-axis-ruler-container'), 'x');

        this.$yAxis = yAxis();
        $content_container.append(this.$yAxis);
        this.yAxisRuler = new hic.Ruler(this, this.$yAxis.find('.hic-y-axis-ruler-container'), 'y');

        // chromosome goto
        this.locusGoto = new hic.LocusGoto(this);
        this.$navbar_container.append(this.locusGoto.$container);

        // colorscale widget
        this.colorscaleWidget = new hic.ColorScaleWidget(this);
        this.$navbar_container.append(this.colorscaleWidget.$container);

        // resolution widget
        this.resolutionSelector = new hic.ResolutionSelector(this);
        this.$navbar_container.append(this.resolutionSelector.$container);


        this.contactMatrixView = new hic.ContactMatrixView(this);
        $content_container.append(this.contactMatrixView.$viewport_container);

        this.state = new hic.State(1, 1, 0, 0, 0, 1);

        function xAxis() {
            var $x_axis,
                $e;

            $x_axis = $('<div class="hic-x-axis">');
            $e = $('<div class="hic-x-axis-ruler-container">');
            $x_axis.append($e);
            return $x_axis
        }

        function yAxis() {
            var $y_axis,
                $e;

            $y_axis = $('<div class="hic-y-axis">');
            $e = $('<div class="hic-y-axis-ruler-container">');
            $y_axis.append($e);
            return $y_axis

        }

        hic.GlobalEventBus.subscribe("LocusChange", this);
        hic.GlobalEventBus.subscribe("DragStopped", this);
    };

    hic.Browser.prototype.getColorScale = function () {
        return this.contactMatrixView.colorScale;
    }

    hic.Browser.prototype.updateColorScale = function (high) {
        this.contactMatrixView.colorScale.scale.high = high;
        this.contactMatrixView.imageTileCache = {};
        this.contactMatrixView.update();
    }

    hic.Browser.prototype.loadHicFile = function (config) {

        var self = this;

        this.hicReader = new hic.HiCReader(config);

        self.contactMatrixView.clearCaches();

        if (!config.url) return;

        self.contactMatrixView.startSpinner();

        self.hicReader.readHeader()
            .then(function () {
                self.hicReader.readFooter()
                    .then(function () {
                        var z;

                        self.chromosomes = self.hicReader.chromosomes;
                        self.bpResolutions = self.hicReader.bpResolutions;
                        self.fragResolutions = self.hicReader.fragResolutions;
                        if (config.state) {
                            self.setState(config.state);
                        }
                        else {

                            z = findDefaultZoom.call(
                                self,
                                self.bpResolutions,
                                defaultPixelSize,
                                self.chromosomes[defaultState.chr1].size);

                            defaultState.zoom = z;

                            self.setState(defaultState);
                        }

                        self.contactMatrixView.stopSpinner();

                        hic.GlobalEventBus.post(new hic.DataLoadEvent());

                    })
                    .catch(function (error) {
                        self.contactMatrixView.stopSpinner();
                        console.log(error);
                    });
            })
    }

    function findDefaultZoom(bpResolutions, defaultPixelSize, chrLength) {

        var viewDimensions = this.contactMatrixView.getViewDimensions(),
            d = Math.max(viewDimensions.width, viewDimensions.height),
            nBins = d / defaultPixelSize,
            z;

        for (z = bpResolutions.length - 1; z >= 0; z--) {
            if (chrLength / bpResolutions[z] <= nBins) {
                return z;
            }
        }
        return 0;

    }

    hic.Browser.prototype.parseGotoInput = function (string) {

        var self = this,
            loci = string.split(' '),
            validLoci,
            bpp,
            xLocus,
            yLocus,
            maxExtent,
            targetResolution,
            newZoom,
            newPixelSize;

        if (loci.length !== 2) {
            console.log('ERROR. Must enter locus for x and y axes.');
        } else {

            xLocus = self.parseLocusString(loci[0]);
            yLocus = self.parseLocusString(loci[1]);

            if (xLocus === undefined || yLocus === undefined) {
                console.log('ERROR. Must enter valid loci for X and Y axes');
            }

            maxExtent = Math.max(locusExtent(xLocus), locusExtent(yLocus));
            targetResolution = maxExtent / (this.contactMatrixView.$viewport.width() / this.state.pixelSize);
            newZoom = findMatchingResolution(targetResolution, this.hicReader.bpResolutions);
            newPixelSize = this.state.pixelSize;   // Adjusting this is complex

            this.setState(new hic.State(
                xLocus.chr,
                yLocus.chr,
                newZoom,
                xLocus.start / this.hicReader.bpResolutions[this.state.zoom],
                yLocus.start / this.hicReader.bpResolutions[this.state.zoom],
                newPixelSize
            ));


        }

        function locusExtent(obj) {
            return obj.end - obj.start;
        }

        function findMatchingResolution(target, resolutionArray) {
            var z;
            for (z = 0; z < resolutionArray.length; z++) {
                if (resolutionArray[z] <= target) {
                    return z;
                }
            }
            return 0;
        }

    };

    hic.Browser.prototype.parseLocusString = function (locus) {

        var self = this,
            parts,
            chrName,
            extent,
            succeeded,
            chromosomeNames,
            locusObject = {},
            numeric;

        parts = locus.trim().split(':');

        chromosomeNames = _.map(self.hicReader.chromosomes, function (chr) {
            return chr.name;
        });

        chrName = parts[0];

        if (!_.contains(chromosomeNames, chrName)) {
            return undefined;
        } else {
            locusObject.chr = _.indexOf(chromosomeNames, chrName);
        }


        if (parts.length === 1) {
            // Chromosome name only
            locusObject.start = 0;
            locusObject.end = this.hicReader.chromosomes[locusObject.chr].size;
        } else {
            extent = parts[1].split("-");
            if (extent.length !== 2) {
                return undefined;
            }
            else {
                _.each(extent, function (value, index) {
                    var numeric = value.replace(/\,/g, '');
                    if (isNaN(numeric)) {
                        return undefined;
                    }
                    locusObject[0 === index ? 'start' : 'end'] = parseInt(numeric, 10);
                });
            }
        }
        return locusObject;
    };

    hic.Browser.prototype.setZoom = function (zoom) {

        // Shift x,y to maintain center, if possible
        var bpResolutions = this.hicReader.bpResolutions,
            viewDimensions = this.contactMatrixView.getViewDimensions(),
            n = viewDimensions.width / (2 * this.state.pixelSize),
            resRatio = bpResolutions[this.state.zoom] / bpResolutions[zoom];

        this.state.zoom = zoom;
        this.state.x = (this.state.x + n) * resRatio - n;
        this.state.y = (this.state.y + n) * resRatio - n;
        this.state.pixelSize = Math.max(defaultPixelSize, minPixelSize.call(this, this.state.chr1, this.state.chr2, zoom));

        this.clamp();

        hic.GlobalEventBus.post(new hic.LocusChangeEvent(this.state));
    };

    hic.Browser.prototype.update = function () {
        hic.GlobalEventBus.post(new hic.LocusChangeEvent(this.state));
    };

    /**
     * Set the matrix state.  Used ot restore state from a bookmark
     * @param state  browser state
     */
    hic.Browser.prototype.setState = function (state) {

        // pass state by value NOT reference
        this.state = (JSON.parse(JSON.stringify(state)));

        // Possibly adjust pixel size
        this.state.pixelSize = Math.max(defaultPixelSize, minPixelSize.call(this, this.state.chr1, this.state.chr2, this.state.zoom));

        hic.GlobalEventBus.post(new hic.LocusChangeEvent(this.state));

    };

    function minPixelSize(chr1, chr2, zoom) {
        var viewDimensions = this.contactMatrixView.getViewDimensions(),
            chr1Length = this.hicReader.chromosomes[chr1].size,
            chr2Length = this.hicReader.chromosomes[chr2].size,
            binSize = this.hicReader.bpResolutions[zoom];
        return Math.max(viewDimensions.width * binSize / chr1Length, viewDimensions.width * binSize / chr2Length);
    }

    hic.Browser.prototype.shiftPixels = function (dx, dy) {

        this.state.x += dx;
        this.state.y += dy;
        this.clamp();

        var locusChangeEvent = new hic.LocusChangeEvent(this.state);
        locusChangeEvent.dragging = true;
        hic.GlobalEventBus.post(locusChangeEvent);
    };

    hic.Browser.prototype.clamp = function () {
        var viewDimensions = this.contactMatrixView.getViewDimensions(),
            chr1Length = this.hicReader.chromosomes[this.state.chr1].size,
            chr2Length = this.hicReader.chromosomes[this.state.chr2].size,
            binSize = this.hicReader.bpResolutions[this.state.zoom],
            maxX = (chr1Length / binSize) - (viewDimensions.width / this.state.pixelSize),
            maxY = (chr2Length / binSize) - (viewDimensions.height / this.state.pixelSize);

        // Negative maxX, maxY indicates pixelSize is not enough to fill view.  In this case we clamp x, y to 0,0
        maxX = Math.max(0, maxX);
        maxY = Math.max(0, maxY);

        this.state.x = Math.min(Math.max(0, this.state.x), maxX);
        this.state.y = Math.min(Math.max(0, this.state.y), maxY);
    };

    hic.Browser.prototype.receiveEvent = function (event) {

        if (event.dragging) return;


        var location = window.location,
            href = location.href;

        var state = gup(href, 'state');
        if (state) {
            href = href.replace("state=" + state, "state=" + this.state.toString());
        }
        else {
            var delim = href.includes("?") ? "&" : "?";
            href += delim + "state=" + this.state.toString();
        }

        // Replace state parameter
        window.history.replaceState(this.state, "juicebox", href);

    };


    function gup(href, name) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regexS = "[\\?&]" + name + "=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(href);
        if (results == null)
            return undefined;
        else
            return results[1];
    }

    return hic;

})
(hic || {});
