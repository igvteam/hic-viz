/*
 *  The MIT License (MIT)
 *
 * Copyright (c) 2016-2017 The Regents of the University of California
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,  FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

/**
 * @author Jim Robinson
 */


var hic = (function (hic) {

    var defaultPixelSize, defaultState;
    var maxPixelSize = 100;
    var DEFAULT_ANNOTATION_COLOR = "rgb(22, 129, 198)";

    var datasetCache = {};


    // mock igv browser objects for igv.js compatibility
    function createIGV($hic_container, hicBrowser, trackMenuReplacement) {

        igv.browser =
            {
                constants: { defaultColor: "rgb(0,0,150)" },

                // Compatibility wit igv menus
                trackContainerDiv: hicBrowser.layoutController.$x_track_container.get(0)
            };

        igv.trackMenuItem = function () {
            return trackMenuReplacement.trackMenuItemReplacement.apply(trackMenuReplacement, arguments);
        };

        igv.trackMenuItemList = function () {
            // var args;
            // args = Array.prototype.slice.call(arguments);
            // args.push(hicBrowser);
            return trackMenuReplacement.trackMenuItemListReplacement.apply(trackMenuReplacement, arguments);
        };

        // Popover object -- singleton shared by all components
        igv.popover = new igv.Popover($hic_container);

        // ColorPicker object -- singleton shared by all components
        igv.colorPicker = new igv.ColorPicker($hic_container, undefined);
        igv.colorPicker.hide();

        // Dialog object -- singleton shared by all components
        igv.dialog = new igv.Dialog($hic_container, igv.Dialog.dialogConstructor);
        igv.dialog.hide();

        // Data Range Dialog object -- singleton shared by all components
        igv.dataRangeDialog = new igv.DataRangeDialog($hic_container);
        igv.dataRangeDialog.hide();
    }

    function destringifyTracks(trackString) {

        var trackTokens = trackString.split("|||"),
            configList = [];

        trackTokens.forEach(function (track) {
            var tokens = track.split("|"),
                url = tokens[0],
                config = {url: url},
                name, dataRangeString, color;

            if (tokens.length > 1) name = tokens[1];
            if (tokens.length > 2) dataRangeString = tokens[2];
            if (tokens.length > 3) color = tokens[3];

            if (name) config.name = name;
            if (dataRangeString) {
                var r = dataRangeString.split("-");
                config.min = parseFloat(r[0]);
                config.max = parseFloat(r[1])
            }
            if (color) config.color = color;

            configList.push(config);
        });
        return configList;

    }

    hic.createBrowser = function ($hic_container, config) {

        var browser;

        setDefaults(config);

        var href = config.href || window.location.href,
            hicUrl = gup(href, "hicUrl"),
            name = gup(href, "name"),
            stateString = gup(href, "state"),
            colorScale = gup(href, "colorScale"),
            trackString = gup(href, "tracks"),
            selectedGene = gup(href, "selectedGene"),
            nvi = gup(href, "nvi");

        defaultPixelSize = 1;

        defaultState = new hic.State(1, 1, 0, 0, 0, defaultPixelSize, "NONE");


        if (hicUrl) {
            config.url = decodeURIComponent(hicUrl);
        }
        if (name) {
            config.name = decodeURIComponent(name);
        }
        if (stateString) {
            stateString = decodeURIComponent(stateString);
            config.state = hic.destringifyState(stateString);

        }
        if (colorScale) {
            config.colorScale = parseFloat(colorScale);
        }

        if (trackString) {
            trackString = decodeURIComponent(trackString);
            config.tracks = destringifyTracks(trackString);
        }

        if (selectedGene) {
            igv.FeatureTrack.selectedGene = selectedGene;
        }

        config.nvi = nvi;

        browser = new hic.Browser($hic_container, config);

        browser.trackMenuReplacement = new hic.TrackMenuReplacement(browser);

        createIGV($hic_container, browser, browser.trackMenuReplacement);

        if (config.url) {
            browser.loadHicFile(config);
        }

        return browser;

    };


    /**
     * Load a dataset outside the context of a browser.  Purpose is to "pre load" a shared dataset when
     * instantiating multiple browsers in a page.
     *
     * @param config
     */
    hic.loadDataset = function (config) {

        return new Promise(function (fulfill, reject) {
            var hicReader = new hic.HiCReader(config);

            hicReader.loadDataset()

                .then(function (dataset) {

                    if (config.nvi) {
                        var nviArray = decodeURIComponent(config.nvi).split(","),
                            range = {start: parseInt(nviArray[0]), size: parseInt(nviArray[1])};

                        hicReader.readNormVectorIndex(dataset, range)
                            .then(function (ignore) {
                                fulfill(dataset);
                            })
                            .catch(function (error) {
                                self.contactMatrixView.stopSpinner();
                                console.log(error);
                            })
                    }
                    else {
                        fulfill(dataset);
                    }
                })
                .catch(reject)
        });
    }


    hic.Browser = function ($app_container, config) {

        var $root;

        //TODO -- remove this global reference !!!!
        hic.browser = this;
        this.config = config;
        this.eventBus = new hic.EventBus();

        this.id = _.uniqueId('browser_');
        this.trackRenderers = [];
        this.tracks2D = [];

        $root = $('<div class="hic-root unselect">');

        if (false === config.showHicContactMapLabel) {
            hic.LayoutController.nav_bar_height = hic.LayoutController.nav_bar_widget_container_height + hic.LayoutController.nav_bar_shim_height;
        } else {
            hic.LayoutController.nav_bar_height = hic.LayoutController.nav_bar_widget_container_height + hic.LayoutController.nav_bar_shim_height + hic.LayoutController.nav_bar_label_height;
        }

        if (config.width) {
            $root.css("width", String(config.width));
        }
        if (config.height) {
            $root.css("height", String(config.height + hic.LayoutController.nav_bar_height));
        }


        $app_container.append($root);

        this.layoutController = new hic.LayoutController(this, $root);

        this.hideCrosshairs();

        this.state = config.state ? config.state : defaultState.clone();

        if (config.colorScale && !isNaN(config.colorScale)) {
            this.contactMatrixView.colorScale.high = config.colorScale;
            this.contactMatrixView.computeColorScale = false;
        }

        this.eventBus.subscribe("LocusChange", this);
        this.eventBus.subscribe("DragStopped", this);
        this.eventBus.subscribe("MapLoad", this);
        this.eventBus.subscribe("ColorScale", this);
        this.eventBus.subscribe("NormalizationChange", this);
    };

    hic.Browser.prototype.updateHref = function (event) {

        var href = window.location.href,
            nviString, trackString;

        if (event && event.type === "MapLoad") {
            href = replaceURIParameter("hicUrl", this.url, href);
            if (this.name) {
                href = replaceURIParameter("name", this.name, href);
            }
        }

        href = replaceURIParameter("state", (this.state.stringify()), href);

        href = replaceURIParameter("colorScale", "" + this.contactMatrixView.colorScale.high, href);

        if (igv.FeatureTrack.selectedGene) {
            href = replaceURIParameter("selectedGene", igv.FeatureTrack.selectedGene, href);
        }


        nviString = getNviString(this.dataset, this.state);
        if (nviString) {
            href = replaceURIParameter("nvi", nviString, href);
        }

        if (this.trackRenderers.length > 0 || this.tracks2D.length > 0) {
            trackString = "";

            this.trackRenderers.forEach(function (trackRenderer) {
                var track = trackRenderer.x.track,
                    config = track.config,
                    url = config.url,
                    name = track.name,
                    dataRange = track.dataRange,
                    color = track.color;

                if (typeof url === "string") {
                    if (trackString.length > 0) trackString += "|||";
                    trackString += url;
                    trackString += "|" + (name ? name : "");
                    trackString += "|" + (dataRange ? (dataRange.min + "-" + dataRange.max) : "");
                    trackString += "|" + (color ? color : "");
                }
            });

            this.tracks2D.forEach(function (track) {
                var config = track.config,
                    url = config.url,
                    name = track.name;

                if (typeof url === "string") {
                    if (trackString.length > 0) trackString += "|||";
                    trackString += url;
                    trackString += "|" + (name ? name : "");
                }
            });

            if (trackString.length > 0) {
                href = replaceURIParameter("tracks", trackString, href);
            }
        }

        if (this.config.updateHref === false) {
            console.log(href);
        }
        else {
            window.history.replaceState("", "juicebox", href);
        }
    };


    hic.Browser.prototype.updateCrosshairs = function (coords) {

        this.contactMatrixView.$x_guide.css({top: coords.y, left: 0});
        this.layoutController.$y_tracks.find("div[id$='x-track-guide']").css({top: coords.y, left: 0});

        this.contactMatrixView.$y_guide.css({top: 0, left: coords.x});
        this.layoutController.$x_tracks.find("div[id$='y-track-guide']").css({top: 0, left: coords.x});

    };

    hic.Browser.prototype.hideCrosshairs = function () {

        _.each([this.contactMatrixView.$x_guide, this.contactMatrixView.$y_guide, this.layoutController.$x_tracks.find("div[id$='y-track-guide']"), this.layoutController.$y_tracks.find("div[id$='x-track-guide']")], function ($e) {
            $e.hide();
        });

    };

    hic.Browser.prototype.showCrosshairs = function () {

        _.each([this.contactMatrixView.$x_guide, this.contactMatrixView.$y_guide, this.layoutController.$x_tracks.find("div[id$='y-track-guide']"), this.layoutController.$y_tracks.find("div[id$='x-track-guide']")], function ($e) {
            $e.show();
        });

    };

    hic.Browser.prototype.genomicState = function () {
        var gs,
            bpResolution;

        bpResolution = this.dataset.bpResolutions[this.state.zoom];

        gs = {};
        gs.bpp = bpResolution / this.state.pixelSize;

        gs.chromosome = {x: this.dataset.chromosomes[this.state.chr1], y: this.dataset.chromosomes[this.state.chr2]};

        gs.startBP = {x: this.state.x * bpResolution, y: this.state.y * bpResolution};
        gs.endBP = {
            x: gs.startBP.x + gs.bpp * this.contactMatrixView.getViewDimensions().width,
            y: gs.startBP.y + gs.bpp * this.contactMatrixView.getViewDimensions().height
        };

        return gs;
    };

    hic.Browser.prototype.getColorScale = function () {
        var cs = this.contactMatrixView.colorScale;
        return cs;
    };

    hic.Browser.prototype.updateColorScale = function (high) {
        this.contactMatrixView.colorScale.high = high;
        this.contactMatrixView.imageTileCache = {};
        this.contactMatrixView.update();
        this.updateHref();
    };

    hic.Browser.prototype.loadTrack = function (trackConfigurations) {
        var self = this,
            promises,
            promises2D;

        promises = [];
        promises2D = [];

        _.each(trackConfigurations, function (config) {

            igv.inferTrackTypes(config);

            if ("annotation" === config.type && config.color === undefined) {
                config.color = DEFAULT_ANNOTATION_COLOR;
            }

            config.height = self.layoutController.track_height;

            if (config.type === undefined) {
                // Assume this is a 2D track
                promises2D.push(hic.loadTrack2D(config));
            }
            else {
                promises.push(loadIGVTrack(config));   // X track
                promises.push(loadIGVTrack(config));   // Y track
            }

        });

        // 1D tracks
        if (promises.length > 0) {
            Promise
                .all(promises)
                .then(function (tracks) {
                    var trackXYPairs = [],
                        index;

                    for (index = 0; index < tracks.length; index += 2) {
                        trackXYPairs.push({x: tracks[index], y: tracks[index + 1]});
                    }

                    self.eventBus.post(hic.Event("TrackLoad", {trackXYPairs: trackXYPairs}));
                })
                .catch(function (error) {
                    console.log(error.message);
                    alert(error.message);
                });
        }

        // 2D tracks
        if (promises2D.length > 0) {
            Promise.all(promises2D)
                .then(function (tracks2D) {
                    self.tracks2D = self.tracks2D.concat(tracks2D);
                    self.eventBus.post(hic.Event("TrackLoad2D", self.tracks2D))

                }).catch(function (error) {
                console.log(error.message);
                alert(error.message);
            });
        }

    };


    function loadIGVTrack(config) {

        return new Promise(function (fulfill, reject) {

            var newTrack;

            newTrack = igv.createTrackWithConfiguration(config);

            if (undefined === newTrack) {
                reject(new Error('Could not create track'));
            } else if (typeof newTrack.getFileHeader === "function") {

                newTrack
                    .getFileHeader()
                    .then(function (header) {
                        fulfill(newTrack);
                    })
                    .catch(reject);

            } else {
                fulfill(newTrack);
            }
        });

    }

    hic.Browser.prototype.renderTracks = function (doSyncCanvas) {

        var list;

        if (_.size(this.trackRenderers) > 0) {

            // append each x-y track pair into a single list for Promise'ing
            list = [];
            _.each(this.trackRenderers, function (xy) {

                // sync canvas size with container div if needed
                _.each(xy, function (r) {
                    if (true === doSyncCanvas) {
                        r.syncCanvas();
                    }
                });

                // concatenate Promises
                list.push(xy.x.promiseToRepaint());
                list.push(xy.y.promiseToRepaint());
            });


            // Execute list of async Promises serially, waiting for
            // completion of one before executing the next.
            Promise
                .all(list)
                .then(function (strings) {
                    // console.log(strings.join('\n'));
                })
                .catch(function (error) {
                    console.log(error.message)
                });

        }

    };

    hic.Browser.prototype.renderTrackXY = function (trackXY) {
        var list;

        // append each x-y track pair into a single list for Promise'ing
        list = [];

        list.push(trackXY.x.promiseToRepaint());
        list.push(trackXY.y.promiseToRepaint());

        Promise
            .all(list)
            .then(function (strings) {
                // console.log(strings.join('\n'));
            })
            .catch(function (error) {
                console.log(error.message)
            });

    };


    hic.Browser.prototype.loadHicFile = function (config) {

        var self = this,
            hicReader,
            queryIdx,
            parts;

        if (!config.url) {
            console.log("No .hic url specified");
            return;
        }

        if (config.url instanceof File) {
            this.url = config.url;
        } else {

            queryIdx = config.url.indexOf("?");
            if (queryIdx > 0) {
                this.url = config.url.substring(0, queryIdx);
                parts = parseUri(config.url);
                if (parts.queryKey) {
                    _.each(parts.queryKey, function (value, key) {
                        config[key] = value;
                    });
                }
            }
            else {
                this.url = config.url;
            }

        }

        this.name = config.name;

        this.$contactMaplabel.text('Contact Map: ' + config.name);

        this.layoutController.removeAllTrackXYPairs();

        this.contactMatrixView.clearCaches();

        this.contactMatrixView.startSpinner();

        hicReader = new hic.HiCReader(config);

        function setDataset(dataset) {
            var previousGenomeId = self.genome ? self.genome.id : undefined;

            self.dataset = dataset;

            self.genome = new hic.Genome(self.dataset.genomeId, self.dataset.chromosomes);

            // TODO -- this is not going to work with browsers on different assemblies on the same page.
            igv.browser.genome = self.genome;

            if (config.state) {
                self.setState(config.state);
            }
            else {
                self.setState(defaultState.clone());
                self.contactMatrixView.computeColorScale = true;
            }
            self.contactMatrixView.setDataset(dataset);

            if (self.genome.id !== previousGenomeId) {
                self.eventBus.post(hic.Event("GenomeChange", self.genome.id));
            }

            if (config.colorScale) {
                self.getColorScale().high = config.colorScale;
            }

            if (config.tracks) {
                self.loadTrack(config.tracks);
            }

            if (dataset.hicReader.normVectorIndex) {
                self.eventBus.post(hic.Event("MapLoad", dataset));
                self.eventBus.post(hic.Event("NormVectorIndexLoad", dataset));
            }
            else {
                if (config.nvi) {

                    var nviArray = decodeURIComponent(config.nvi).split(","),
                        range = {start: parseInt(nviArray[0]), size: parseInt(nviArray[1])};

                    dataset.hicReader.readNormVectorIndex(dataset, range)
                        .then(function (ignore) {
                            self.eventBus.post(hic.Event("MapLoad", dataset));
                            self.eventBus.post(hic.Event("NormVectorIndexLoad", dataset));

                        })
                        .catch(function (error) {
                            self.contactMatrixView.stopSpinner();
                            console.log(error);
                        })
                } else {

                    self.eventBus.post(hic.Event("MapLoad", dataset));

                    // Load norm vector index in the background
                    dataset.hicReader.readExpectedValuesAndNormVectorIndex(dataset)
                        .then(function (ignore) {
                            self.eventBus.post(hic.Event("NormVectorIndexLoad", dataset));
                        })
                        .catch(function (error) {
                            self.contactMatrixView.stopSpinner();
                            console.log(error);
                        });
                }
            }
        }

        if (config.dataset) {
            setDataset(config.dataset);
        }
        else {
            hicReader.loadDataset()

                .then(function (dataset) {
                    setDataset(dataset);

                })
                .catch(function (error) {
                    // Error getting dataset
                    self.contactMatrixView.stopSpinner();
                    console.log(error);
                });
        }

    };


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
            xLocus,
            yLocus;


        if (loci.length === 1) {
            xLocus = self.parseLocusString(loci[0]);
            yLocus = xLocus;
        } else {
            xLocus = self.parseLocusString(loci[0]);
            yLocus = self.parseLocusString(loci[1]);
            if (yLocus === undefined) yLocus = xLocus;
        }

        if (xLocus === undefined) {
            // Try a gene name search.
            hic.geneSearch(this.genome.id, loci[0].trim())

                .then(function (result) {
                    if (result) {
                        igv.FeatureTrack.selectedGene = loci[0].trim();
                        xLocus = self.parseLocusString(result);
                        yLocus = xLocus;
                        self.state.selectedGene = loci[0].trim();
                        self.goto(xLocus.chr, xLocus.start, xLocus.end, yLocus.chr, yLocus.start, yLocus.end, 5000);
                    }
                    else {
                        alert('No feature found with name "' + loci[0] + '"');
                    }
                })
                .catch(function (error) {
                    alert(error);
                    console.log(error);
                });
        } else {

            if (xLocus.wholeChr && yLocus.wholeChr) {
                self.setChromosomes(xLocus.chr, yLocus.chr);
            }
            else {
                self.goto(xLocus.chr, xLocus.start, xLocus.end, yLocus.chr, yLocus.start, yLocus.end, 200);
            }
        }

    }

    hic.Browser.prototype.findMatchingZoomIndex = function (targetResolution, resolutionArray) {
        var z;
        for (z = resolutionArray.length - 1; z > 0; z--) {
            if (resolutionArray[z] >= targetResolution) {
                return z;
            }
        }
        return 0;
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

        chromosomeNames = _.map(self.dataset.chromosomes, function (chr) {
            return chr.name;
        });

        chrName = this.genome.getChromosomeName(parts[0]);

        if (!_.contains(chromosomeNames, chrName)) {
            return undefined;
        } else {
            locusObject.chr = _.indexOf(chromosomeNames, chrName);
        }


        if (parts.length === 1) {
            // Chromosome name only
            locusObject.start = 0;
            locusObject.end = this.dataset.chromosomes[locusObject.chr].size;
            locusObject.wholeChr = true;
        } else {
            extent = parts[1].split("-");
            if (extent.length !== 2) {
                return undefined;
            }
            else {
                numeric = extent[0].replace(/\,/g, '');
                locusObject.start = isNaN(numeric) ? undefined : parseInt(numeric, 10) - 1;

                numeric = extent[1].replace(/\,/g, '');
                locusObject.end = isNaN(numeric) ? undefined : parseInt(numeric, 10);
            }
        }
        return locusObject;
    };

    hic.Browser.prototype.setZoom = function (zoom) {

        this.contactMatrixView.clearCaches();
        this.contactMatrixView.computeColorScale = true;

        // Shift x,y to maintain center, if possible
        var bpResolutions = this.dataset.bpResolutions,
            currentResolution = bpResolutions[this.state.zoom],
            viewDimensions = this.contactMatrixView.getViewDimensions(),
            xCenter = this.state.x + viewDimensions.width / (2 * this.state.pixelSize),    // center in bins
            yCenter = this.state.y + viewDimensions.height / (2 * this.state.pixelSize),    // center in bins
            newResolution = bpResolutions[zoom],
            newXCenter = xCenter * (currentResolution / newResolution),
            newYCenter = yCenter * (currentResolution / newResolution),
            newPixelSize = Math.max(defaultPixelSize, minPixelSize.call(this, this.state.chr1, this.state.chr2, zoom));


        this.state.zoom = zoom;
        this.state.x = Math.max(0, newXCenter - viewDimensions.width / (2 * newPixelSize));
        this.state.y = Math.max(0, newYCenter - viewDimensions.height / (2 * newPixelSize));
        this.state.pixelSize = newPixelSize;

        this.clamp();

        this.eventBus.post(hic.Event("LocusChange", this.state));
    };

    hic.Browser.prototype.updateLayout = function () {
        this.state.pixelSize = Math.max(defaultPixelSize, minPixelSize.call(this, this.state.chr1, this.state.chr2, this.state.zoom));
        this.clamp();
        this.renderTracks(true);
        this.contactMatrixView.clearCaches();
        this.contactMatrixView.update();


    };

    hic.Browser.prototype.setChromosomes = function (chr1, chr2) {

        this.state.chr1 = Math.min(chr1, chr2);
        this.state.chr2 = Math.max(chr1, chr2);
        this.state.zoom = 0;
        this.state.x = 0;
        this.state.y = 0;

        this.state.pixelSize = Math.min(maxPixelSize, Math.max(defaultPixelSize, minPixelSize.call(this, this.state.chr1, this.state.chr2, this.state.zoom)));

        this.contactMatrixView.computeColorScale = true;

        this.eventBus.post(hic.Event("LocusChange", this.state));
    };

    hic.Browser.prototype.updateLayout = function () {
        this.state.pixelSize = Math.max(defaultPixelSize, minPixelSize.call(this, this.state.chr1, this.state.chr2, this.state.zoom));
        this.clamp();
        this.renderTracks(true);
        this.layoutController.xAxisRuler.update();
        this.layoutController.yAxisRuler.update();
        this.contactMatrixView.clearCaches();
        this.contactMatrixView.update();
    };

    function minPixelSize(chr1, chr2, zoom) {
        var viewDimensions = this.contactMatrixView.getViewDimensions(),
            chr1Length = this.dataset.chromosomes[chr1].size,
            chr2Length = this.dataset.chromosomes[chr2].size,
            binSize = this.dataset.bpResolutions[zoom],
            nBins1 = chr1Length / binSize,
            nBins2 = chr2Length / binSize;

        // Crude test for "whole genome"
        var isWholeGenome = this.dataset.chromosomes[chr1].name === "All";
        if (isWholeGenome) {
            nBins1 *= 1000;
            nBins2 *= 1000;
        }

        return Math.min(viewDimensions.width / nBins1, viewDimensions.height / nBins2);
//        return Math.min(viewDimensions.width * (binSize / chr1Length), viewDimensions.height * (binSize / chr2Length));
    }

    hic.Browser.prototype.update = function () {
        this.eventBus.post(hic.Event("LocusChange", this.state));
    };

    /**
     * Set the matrix state.  Used ot restore state from a bookmark
     * @param state  browser state
     */
    hic.Browser.prototype.setState = function (state) {

        this.state = state;

        // Possibly adjust pixel size
        this.state.pixelSize = Math.max(state.pixelSize, minPixelSize.call(this, this.state.chr1, this.state.chr2, this.state.zoom));

        this.eventBus.post(hic.Event("LocusChange", this.state));

    };

    hic.Browser.prototype.setNormalization = function (normalization) {

        this.state.normalization = normalization;
        this.contactMatrixView.computeColorScale = true;
        this.eventBus.post(hic.Event("NormalizationChange", this.state.normalization))

    };

    hic.Browser.prototype.shiftPixels = function (dx, dy) {

        this.state.x += (dx / this.state.pixelSize);
        this.state.y += (dy / this.state.pixelSize);
        this.clamp();

        var locusChangeEvent = hic.Event("LocusChange", this.state);
        locusChangeEvent.dragging = true;
        this.eventBus.post(locusChangeEvent);
    };


    hic.Browser.prototype.goto = function (chr1, bpX, bpXMax, chr2, bpY, bpYMax, minResolution) {


        var xCenter,
            yCenter,
            targetResolution,
            viewDimensions = this.contactMatrixView.getViewDimensions(),
            viewWidth = viewDimensions.width,
            maxExtent;

        if (minResolution === undefined) minResolution = 200;

        targetResolution = Math.max((bpXMax - bpX) / viewDimensions.width, (bpYMax - bpY) / viewDimensions.height);


        if (targetResolution < minResolution) {
            maxExtent = viewWidth * minResolution;
            xCenter = (bpX + bpXMax) / 2;
            yCenter = (bpY + bpYMax) / 2;
            bpX = Math.max(xCenter - maxExtent / 2);
            bpY = Math.max(0, yCenter - maxExtent / 2);
            targetResolution = minResolution;
        }

        var bpResolutions = this.dataset.bpResolutions,
            newZoom = this.findMatchingZoomIndex(targetResolution, bpResolutions),
            newResolution = bpResolutions[newZoom],
            newPixelSize = Math.max(1, newResolution / targetResolution),
            newXBin = bpX / newResolution,
            newYBin = bpY / newResolution;

        this.state.chr1 = chr1;
        this.state.chr2 = chr2;
        this.state.zoom = newZoom;
        this.state.x = newXBin;
        this.state.y = newYBin;
        this.state.pixelSize = newPixelSize;

        this.contactMatrixView.clearCaches();
        this.contactMatrixView.computeColorScale = true;
        this.eventBus.post(hic.Event("LocusChange", this.state));

    };

    hic.Browser.prototype.clamp = function () {
        var viewDimensions = this.contactMatrixView.getViewDimensions(),
            chr1Length = this.dataset.chromosomes[this.state.chr1].size,
            chr2Length = this.dataset.chromosomes[this.state.chr2].size,
            binSize = this.dataset.bpResolutions[this.state.zoom],
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

        this.updateHref(event);
    };


    hic.Browser.prototype.resolution = function () {
        return this.dataset.bpResolutions[this.state.zoom];
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

    function replaceURIParameter(key, newValue, href) {


        var oldValue = gup(href, key);
        if (oldValue) {
            href = href.replace(key + "=" + oldValue, key + "=" + encodeURIComponent(newValue));
        }
        else {
            var delim = href.includes("?") ? "&" : "?";
            href += delim + key + "=" + encodeURIComponent(newValue);
        }

        return href;

    }

    hic.State = function (chr1, chr2, zoom, x, y, pixelSize) {

        this.chr1 = chr1;
        this.chr2 = chr2;
        this.zoom = zoom;
        this.x = x;
        this.y = y;
        this.pixelSize = pixelSize;
    };

    // Set default values for config properties
    function setDefaults(config) {

        if (undefined === config.gestureSupport) {
            config.gestureSupport = false;
        }

        if (config.miniMode === true) {
            config.showLocusGoto = false;
            config.showHicContactMapLabel = false;
            config.showChromosomeSelector = false;
            config.updateHref = false;
        }
        else {
            if (undefined === config.updateHref) {
                config.updateHref = true;
            }
            if (undefined === config.showLocusGoto) {
                config.showLocusGoto = true;
            }
            if (undefined === config.showHicContactMapLabel) {
                config.showHicContactMapLabel = true;
            }
            if (undefined === config.showChromosomeSelector) {
                config.showChromosomeSelector = true
            }

        }
    }

    function getNviString(dataset, state) {

        if (dataset.hicReader.normalizationVectorIndexRange) {
            var range = dataset.hicReader.normalizationVectorIndexRange,
                nviString = String(range.start) + "," + String(range.size);
            return nviString
        }
        else {
            return undefined;
        }
    }

    // parseUri 1.2.2
    // (c) Steven Levithan <stevenlevithan.com>
    // MIT License

    function parseUri(str) {
        var o = parseUri.options,
            m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
            uri = {},
            i = 14;

        while (i--) uri[o.key[i]] = m[i] || "";

        uri[o.q.name] = {};
        uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
            if ($1) uri[o.q.name][$1] = $2;
        });

        return uri;
    };

    parseUri.options = {
        strictMode: false,
        key: ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"],
        q: {
            name: "queryKey",
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g
        },
        parser: {
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
        }
    };

    return hic;

})
(hic || {});
