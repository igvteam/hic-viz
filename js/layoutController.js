/**
 * Created by dat on 4/4/17.
 */
var hic = (function (hic) {

    hic.LayoutController = function (browser, $root) {

        this.browser = browser;

        createNavBar.call(this, browser, $root);

        createAllContainers.call(this, browser, $root);

        this.scrollbar_height = 20;
        this.axis_height = 32;

        this.track_height = 32;

    };

    // Dupes of corresponding juicebox.scss variables
    // Invariant during app running. If edited in juicebox.scss they MUST be kept in sync
    hic.LayoutController.nav_bar_label_height = 36;
    hic.LayoutController.nav_bar_widget_container_height = 36;
    hic.LayoutController.nav_bar_shim_height = 4;

    hic.LayoutController.navbarHeight = function (figureMode) {
        var height;
        if (true === figureMode) {
            height = hic.LayoutController.nav_bar_label_height;
        } else {
            height = (2 * hic.LayoutController.nav_bar_label_height) + (2 * hic.LayoutController.nav_bar_widget_container_height) + hic.LayoutController.nav_bar_shim_height;
        }
        // console.log('navbar height ' + height);
        return height;
    };

    function createNavBar(browser, $root) {

        var id,
            $navbar_container,
            $map_container,
            $upper_widget_container,
            $lower_widget_container,
            $e,
            $fa;

        $navbar_container = $('<div class="hic-navbar-container">');
        $root.append($navbar_container);

        if (true === browser.config.figureMode) {
            $navbar_container.height(hic.LayoutController.navbarHeight(browser.config.figureMode));
        } else {

            $navbar_container.on('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                hic.Browser.setCurrentBrowser(browser);
            });

        }

        // container: contact map label | menu button | browser delete button
        id = browser.id + '_contact-map-' + 'hic-nav-bar-map-container';
        $map_container = $("<div>", { id: id });
        $navbar_container.append($map_container);

        // contact map label
        id = browser.id + '_contact-map-' + 'hic-nav-bar-map-label';
        browser.$contactMaplabel = $("<div>", {id: id});
        $map_container.append(browser.$contactMaplabel);

        // menu button
        browser.$menuPresentDismiss = $("<div>", {class: 'hic-nav-bar-menu-button'});
        $map_container.append(browser.$menuPresentDismiss);

        $fa = $("<i>", {class: 'fa fa-bars fa-lg'});
        browser.$menuPresentDismiss.append($fa);
        $fa.on('click', function (e) {
            browser.toggleMenu();
        });

        // browser delete button
        $e = $("<div>", {class: 'hic-nav-bar-delete-button'});
        $map_container.append($e);

        $fa = $("<i>", {class: 'fa fa-minus-circle fa-lg'});
        $e.append($fa);

        $fa.on('click', function (e) {

            if (browser === hic.Browser.getCurrentBrowser()) {
                hic.Browser.setCurrentBrowser(undefined);
            }

            hic.allBrowsers.splice(_.indexOf(hic.allBrowsers, browser), 1);
            browser.$root.remove();
            browser = undefined;

            if (1 === hic.allBrowsers.length) {
                $('.hic-nav-bar-delete-button').hide();
                hic.Browser.setCurrentBrowser(hic.allBrowsers[ 0 ]);
            }

        });

        // hide delete buttons for now. Delete button is only
        // if there is more then one browser instance.
        $e.hide();


        // container: control map label
        id = browser.id + '_control-map-' + 'hic-nav-bar-map-container';
        $map_container = $("<div>", { id: id });
        $navbar_container.append($map_container);

        // control map label
        id = browser.id + '_control-map-' + 'hic-nav-bar-map-label';
        browser.$controlMaplabel = $("<div>", {id: id});
        $map_container.append(browser.$controlMaplabel);








        // upper widget container
        id = browser.id + '_upper_' + 'hic-nav-bar-widget-container';
        $upper_widget_container = $("<div>", {id: id});
        $navbar_container.append($upper_widget_container);

        // location box / goto
        browser.locusGoto = new hic.LocusGoto(browser, $upper_widget_container);

        // resolution widget
        // browser.resolutionSelector = new hic.ResolutionSelector(browser, $upper_widget_container);
        // browser.resolutionSelector.setResolutionLock(browser.resolutionLocked);

        if (true === browser.config.figureMode) {
            browser.$contactMaplabel.addClass('hidden-text');
            $upper_widget_container.hide();
        } else {

            // lower widget container
            id = browser.id + '_lower_' + 'hic-nav-bar-widget-container';
            $lower_widget_container = $("<div>", {id: id});
            $navbar_container.append($lower_widget_container);

            // colorscale
            browser.colorscaleWidget = new hic.ColorScaleWidget(browser, $lower_widget_container);

            // control map
            browser.controlMapWidget = new hic.ControlMapWidget(browser, $lower_widget_container);

            // normalization
            browser.normalizationSelector = new hic.NormalizationWidget(browser, $lower_widget_container);

            // resolution widget
            browser.resolutionSelector = new hic.ResolutionSelector(browser, $lower_widget_container);
            browser.resolutionSelector.setResolutionLock(browser.resolutionLocked);

        }

    }

    function createAllContainers(browser, $root) {

        var id,
            tokens,
            height_calc,
            $container,
            $e;

        // .hic-x-track-container
        id = browser.id + '_' + 'x-track-container';
        this.$x_track_container = $("<div>", {id: id});
        $root.append(this.$x_track_container);

        // track labels
        id = browser.id + '_' + 'track-shim';
        this.$track_shim = $("<div>", {id: id});
        this.$x_track_container.append(this.$track_shim);

        // x-tracks
        id = browser.id + '_' + 'x-tracks';
        this.$x_tracks = $("<div>", {id: id});
        this.$x_track_container.append(this.$x_tracks);

        // crosshairs guide
        id = browser.id + '_' + 'y-track-guide';
        this.$y_track_guide = $("<div>", {id: id});
        this.$x_tracks.append(this.$y_track_guide);

        // content container
        id = browser.id + '_' + 'content-container';
        this.$content_container = $("<div>", {id: id});
        $root.append(this.$content_container);

        // If we are in mini-mode we must recalculate the content container height
        // to coinside with the root browser container height
        if (true === browser.config.figureMode) {
            tokens = _.map([hic.LayoutController.navbarHeight(browser.config.figureMode)], function (number) {
                return number.toString() + 'px';
            });
            height_calc = 'calc(100% - (' + tokens.join(' + ') + '))';

            this.$content_container.css('height', height_calc);
        }


        // menu
        createMenu(browser, $root);


        // container: x-axis
        id = browser.id + '_' + 'x-axis-container';
        $container = $("<div>", {id: id});
        this.$content_container.append($container);
        this.xAxisRuler = new hic.Ruler(browser, 'x', $container);


        // container: y-tracks | y-axis | viewport | y-scrollbar
        id = browser.id + '_' + 'y-tracks-y-axis-viewport-y-scrollbar';
        $container = $("<div>", {id: id});
        this.$content_container.append($container);

        // y-tracks
        id = browser.id + '_' + 'y-tracks';
        this.$y_tracks = $("<div>", {id: id});
        $container.append(this.$y_tracks);

        // crosshairs guide
        id = browser.id + '_' + 'x-track-guide';
        this.$x_track_guide = $("<div>", {id: id});
        this.$y_tracks.append(this.$x_track_guide);

        // y-axis
        this.yAxisRuler = new hic.Ruler(browser, 'y', $container);

        this.xAxisRuler.$otherRulerCanvas = this.yAxisRuler.$canvas;
        this.xAxisRuler.otherRuler = this.yAxisRuler;

        this.yAxisRuler.$otherRulerCanvas = this.xAxisRuler.$canvas;
        this.yAxisRuler.otherRuler = this.xAxisRuler;

        // viewport | y-scrollbar
        browser.contactMatrixView = new hic.ContactMatrixView(browser, $container);

        // container: x-scrollbar
        id = browser.id + '_' + 'x-scrollbar-container';
        $container = $("<div>", {id: id});
        this.$content_container.append($container);

        // x-scrollbar
        $container.append(browser.contactMatrixView.scrollbarWidget.$x_axis_scrollbar_container);

    }

    function createMenu(browser, $root) {

        var $menu,
            $div,
            $fa,
            config;

        // menu
        $menu = $('<div>', {class: 'hic-menu'});
        $root.append($menu);

        // menu close button
        $div = $('<div>', {class: 'hic-menu-close-button'});
        $menu.append($div);

        // $fa = $("<i>", { class:'fa fa-minus-circle fa-lg' });
        $fa = $("<i>", {class: 'fa fa-times'});
        $div.append($fa);

        $fa.on('click', function (e) {
            browser.toggleMenu();
        });


        // chromosome select widget
        browser.chromosomeSelector = new hic.ChromosomeSelectorWidget(browser, $menu);

        if (true === browser.config.figureMode) {

            browser.chromosomeSelector.$container.hide();

            // colorscale
            browser.colorscaleWidget = new hic.ColorScaleWidget(browser, $menu);

            // normalization
            browser.normalizationSelector = new hic.NormalizationWidget(browser, $menu);

            // resolution widget
            browser.resolutionSelector = new hic.ResolutionSelector(browser, $menu);
            browser.resolutionSelector.setResolutionLock(browser.resolutionLocked);
        }

        config =
        {
            title: '2D Annotations',
            loadTitle: 'Load:',
            alertMessage: 'No 2D annotations currently loaded for this map'
        };
        browser.annotation2DWidget = new hic.AnnotationWidget(browser, $menu, config, function () {
            return browser.tracks2D;
        });

        config =
        {
            title: 'Tracks',
            loadTitle: 'Load Tracks:',
            alertMessage: 'No tracks currently loaded for this map'
        };

        browser.annotation1DDWidget = new hic.AnnotationWidget(browser, $menu, config, function () {
            return browser.trackRenderers;
        });

        browser.$menu = $menu;

        browser.$menu.hide();

    }

    hic.LayoutController.prototype.tracksLoaded = function (trackXYPairs) {
        var self = this,
            trackRendererPair;

        self.doLayoutTrackXYPairCount(trackXYPairs.length + self.browser.trackRenderers.length);

        trackXYPairs.forEach(function (trackPair, index) {

            var w, h;

            trackRendererPair = {};
            w = h = self.track_height;
            trackRendererPair.x = new hic.TrackRenderer(self.browser, {
                width: undefined,
                height: h
            }, self.$x_tracks, trackRendererPair, trackPair, 'x', index);
            trackRendererPair.y = new hic.TrackRenderer(self.browser, {
                width: w,
                height: undefined
            }, self.$y_tracks, trackRendererPair, trackPair, 'y', index);

            self.browser.trackRenderers.push(trackRendererPair);

        });



    }


    hic.LayoutController.prototype.removeAllTrackXYPairs = function () {
        var self = this,
            indices;

        indices = _.range(_.size(this.browser.trackRenderers));

        if (0 === _.size(indices)) {
            return;
        }

        _.each(indices, function (unused) {
            var discard,
                index;

            // select last track to dicard
            discard = _.last(self.browser.trackRenderers);

            // discard DOM element's
            discard['x'].$viewport.remove();
            discard['y'].$viewport.remove();

            // remove discard from list
            index = self.browser.trackRenderers.indexOf(discard);
            self.browser.trackRenderers.splice(index, 1);

            discard = undefined;
            self.doLayoutTrackXYPairCount(_.size(self.browser.trackRenderers));
        });

        // this.browser.updateLayout();
    };

    hic.LayoutController.prototype.removeLastTrackXYPair = function () {
        var index,
            discard;

        if (_.size(this.browser.trackRenderers) > 0) {

            // select last track to dicard
            discard = _.last(this.browser.trackRenderers);

            // discard DOM element's
            discard['x'].$viewport.remove();
            discard['y'].$viewport.remove();

            // remove discard from list
            index = this.browser.trackRenderers.indexOf(discard);
            this.browser.trackRenderers.splice(index, 1);

            discard = undefined;
            this.doLayoutTrackXYPairCount(_.size(this.browser.trackRenderers));

            this.browser.updateLayout();

        } else {
            console.log('No more tracks.');
        }

    };

    hic.LayoutController.prototype.removeTrackRendererPair = function (trackRendererPair) {

        var index,
            discard;

        if (_.size(this.browser.trackRenderers) > 0) {

            discard = trackRendererPair;

            // discard DOM element's
            discard['x'].$viewport.remove();
            discard['y'].$viewport.remove();

            // remove discard from list
            index = this.browser.trackRenderers.indexOf(discard);
            this.browser.trackRenderers.splice(index, 1);

            this.doLayoutTrackXYPairCount(_.size(this.browser.trackRenderers));

            this.browser.updateLayout();


        } else {
            console.log('No more tracks.');
        }

    };

    hic.LayoutController.prototype.doLayoutTrackXYPairCount = function (trackXYPairCount) {

        var track_aggregate_height,
            tokens,
            width_calc,
            height_calc;


        track_aggregate_height = (0 === trackXYPairCount) ? 0 : trackXYPairCount * this.track_height;

        tokens = _.map([hic.LayoutController.navbarHeight(this.browser.config.figureMode), track_aggregate_height], function (number) {
            return number.toString() + 'px';
        });
        height_calc = 'calc(100% - (' + tokens.join(' + ') + '))';

        tokens = _.map([track_aggregate_height, this.axis_height, this.scrollbar_height], function (number) {
            return number.toString() + 'px';
        });
        width_calc = 'calc(100% - (' + tokens.join(' + ') + '))';

        // x-track container
        this.$x_track_container.height(track_aggregate_height);

        // track labels
        this.$track_shim.width(track_aggregate_height);

        // x-tracks
        this.$x_tracks.css('width', width_calc);


        // content container
        this.$content_container.css('height', height_calc);

        // x-axis - repaint canvas
        this.xAxisRuler.updateWidthWithCalculation(width_calc);

        // y-tracks
        this.$y_tracks.width(track_aggregate_height);

        // y-axis - repaint canvas
        this.yAxisRuler.updateHeight(this.yAxisRuler.$axis.height());

        // viewport
        this.browser.contactMatrixView.$viewport.css('width', width_calc);

        // x-scrollbar
        this.browser.contactMatrixView.scrollbarWidget.$x_axis_scrollbar_container.css('width', width_calc);

    };

    hic.LayoutController.prototype.doLayoutWithRootContainerSize = function (size) {

        var count;

        this.browser.$root.width(size.width);
        this.browser.$root.height(size.height + hic.LayoutController.navbarHeight(this.browser.config.figureMode));

        count = _.size(this.browser.trackRenderers) > 0 ? _.size(this.browser.trackRenderers) : 0;
        this.doLayoutTrackXYPairCount(count);

        this.browser.updateLayout();
    };

    return hic;
})(hic || {});
