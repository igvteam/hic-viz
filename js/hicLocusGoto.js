/**
 * Created by dat on 3/3/17.
 */
var hic = (function (hic) {

    hic.LocusGoto = function(browser) {

        this.browser = browser;
        this.$resolution_selector = $('<input class="hic-chromosome-goto-input" type="text" placeholder="chr-x-axis chr-y-axis">');
        this.$resolution_selector.on('change', function(e){
            var value = $(this).val();
            browser.parseGotoInput( value );
        });

        // chromosome goto container
        this.$container = $('<div class="hic-chromosome-goto-container">');
        this.$container.append(this.$resolution_selector);

        hic.GlobalEventBus.subscribe("LocusChange", this);
    };

    hic.LocusGoto.prototype.receiveEvent = function(event) {

        var self = this,
            bpPerBin,
            pixelsPerBin,
            dimensionsPixels,
            chrs,
            startsBP,
            endsBP,
            xy;

        if (event.type === "LocusChange") {

            chrs = _.map([ event.state.chr1, event.state.chr2 ], function(index) {
                return self.browser.hicReader.chromosomes[ index ].name;
            });

            bpPerBin = this.browser.hicReader.bpResolutions[ event.state.zoom ];
            dimensionsPixels = this.browser.contactMatrixView.getViewDimensions();
            pixelsPerBin = event.state.pixelSize;

            startsBP = _.map([ event.state.x, event.state.y ], function(bin) {
                return 1 + Math.round(bin * bpPerBin);
            });

            endsBP = _.map([ dimensionsPixels.width, dimensionsPixels.height ], function(pixels, index) {
                return Math.round(((pixels / pixelsPerBin) * bpPerBin)) + startsBP[ index ];
            });

            xy = _.map([0, 1], function(index) {
                return chrs[ index ] + ':' + igv.numberFormatter(startsBP[ index ]) + '-' + igv.numberFormatter(endsBP[ index ]);
            });

            this.$resolution_selector.val(xy.join(' '));
        } 


    };

    return hic;

})
(hic || {});
