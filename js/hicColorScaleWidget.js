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
 * Created by dat on 3/6/17.
 */
/**
 * Created by dat on 3/3/17.
 */
var hic = (function (hic) {

    hic.ColorScaleWidget = function(browser) {

        var $label;

        this.browser = browser;

        $label = $('<label>');
        $label.text('Color Scale');

        this.$high_colorscale_input = $('<input type="text" placeholder="high">');
        this.$high_colorscale_input.on('change', function(e){
            var value = $(this).val(),
                numeric = value.replace(/\,/g, '');
            if (isNaN(numeric)) {
   // Error message ?
            }
            else {
                browser.updateColorScale(parseInt(numeric, 10))
            }
        });

        this.$container = $('<div class="hic-colorscale-widget-container">');
        this.$container.append($label);
        this.$container.append(this.$high_colorscale_input);

        hic.GlobalEventBus.subscribe("DataLoad", this);
        hic.GlobalEventBus.subscribe("ColorScale", this);
    };

    hic.ColorScaleWidget.prototype.receiveEvent = function(event) {

        if (event.type === "DataLoad" || event.type === "ColorScale") {
            // do stuff
     //       this.$low_colorscale_input.val(igv.numberFormatter(this.browser.contactMatrixView.colorScale.scale.low));
            this.$high_colorscale_input.val(igv.numberFormatter(this.browser.getColorScale().high));
        }

    };

    return hic;

})
(hic || {});
