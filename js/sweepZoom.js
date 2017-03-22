/**
 * Created by dat on 3/14/17.
 */
var hic = (function (hic) {

    hic.SweepZoom = function (browser, $rulerSweeper) {
        this.browser = browser;
        this.$rulerSweeper = $rulerSweeper;
        this.$rulerSweeper.hide();
        this.sweepRect = {};
    };

    hic.SweepZoom.prototype.reset = function () {
        this.aspectRatio = this.browser.contactMatrixView.getViewDimensions().width / this.browser.contactMatrixView.getViewDimensions().height;
        this.sweepRect.origin = {x: 0, y: 0};
        this.sweepRect.size = {width: 1, height: 1};
    };

    hic.SweepZoom.prototype.update = function (mouseDown, coords, viewportBBox) {
        var displacement,
            delta,
            dominantAxis,
            aspectRatioScale,
            xMax,
            yMax;


        delta = {x: (coords.x - mouseDown.x), y: (coords.y - mouseDown.y)};

        this.sweepRect.origin.x = (delta.x < 0 ? mouseDown.x + delta.x : mouseDown.x);
        this.sweepRect.origin.y = (delta.y < 0 ? mouseDown.y + delta.y : mouseDown.y);

        dominantAxis = (Math.abs(delta.x) > Math.abs(delta.y) ? 'x' : 'y');

        if ('x' === dominantAxis) {
            displacement = Math.abs(delta.x);
            aspectRatioScale = {x: 1.0, y: 1.0 / this.aspectRatio};
        } else {
            displacement = Math.abs(delta.y);
            aspectRatioScale = {x: this.aspectRatio, y: 1.0};
        }

        this.sweepRect.size = {width: aspectRatioScale.x * displacement, height: aspectRatioScale.y * displacement};

        xMax = (mouseDown.x + this.sweepRect.size.width ) - viewportBBox.size.width;
        yMax = (mouseDown.y + this.sweepRect.size.height) - viewportBBox.size.height;
        if ('y' === dominantAxis && xMax > 0) {
            this.sweepRect.size.width -= xMax;
            this.sweepRect.size.height = this.sweepRect.size.width / this.aspectRatio;
        } else if (yMax > 0) {
            this.sweepRect.size.height -= yMax;
            this.sweepRect.size.width = this.sweepRect.size.height * this.aspectRatio;
        }

        this.$rulerSweeper.css(rectToCSS(this.sweepRect));
        this.$rulerSweeper.show();

    };

    hic.SweepZoom.prototype.dismiss = function () {
        var s = this.browser.state,
            bpResolution = this.browser.resolution(),
            bpX = (s.x + this.sweepRect.origin.x / s.pixelSize) * bpResolution,
            bpY = (s.y + this.sweepRect.origin.y / s.pixelSize) * bpResolution,
            bpXMax = bpX + (this.sweepRect.size.width / s.pixelSize) * bpResolution,
            bpYMax = bpY + (this.sweepRect.size.height / s.pixelSize) * bpResolution;

        this.$rulerSweeper.hide();
        this.browser.goto(bpX, bpXMax, bpY, bpYMax);

        // rawScaleFactor = this.sweepRect.size.width / this.browser.contactMatrixView.getViewDimensions().width;
        // zoomIndex = this.browser.findMatchingZoomIndex(rawScaleFactor * this.browser.resolution(), bpResolutions);
        //
        // resRatio = bpResolution / bpResolutions[zoomIndex];
        //
        // newBinX = (s.x + (this.sweepRect.origin.x / s.pixelSize)) * resRatio;
        // newBinY = (s.y + (this.sweepRect.origin.y / s.pixelSize)) * resRatio;
        //
        // this.browser.setState(new hic.State(
        //     s.chr1,
        //     s.chr2,
        //     zoomIndex,
        //     newBinX,
        //     newBinY,
        //     s.pixelSize
        // ));

    };

    function rectToCSS(rect) {

        var css = {};

        _.extend(css, {'left': rect.origin.x + 'px'});
        _.extend(css, {'top': rect.origin.y + 'px'});

        _.extend(css, {'width': rect.size.width + 'px'});
        _.extend(css, {'height': rect.size.height + 'px'});

        return css;
    }

    return hic;
})(hic || {});