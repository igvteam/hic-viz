/**
 * Created by dat on 5/7/17.
 */

var hic = (function (hic) {

    hic.TrackMenuReplacement = function () {
    };

    hic.TrackMenuReplacement.prototype.popoverPresentTrackGearMenuReplacement = function (pageX, pageY, trackView) {

        var $container,
            items;

        items = igv.trackMenuItemList(this, trackView);
        if (_.size(items) > 0) {

            this.$popoverContent.empty();
            this.$popoverContent.removeClass("igv-popover-track-popup-content");

            $container = $('<div class="igv-track-menu-container">');
            this.$popoverContent.append($container);

            _.each(items, function(item) {

                if (item.init) {
                    item.init(undefined);
                }

                $container.append(item.object);

            });

            this.$popover.css({ left: pageX + 'px', top: pageY + 'px' });
            this.$popover.show();
        }
    };

    hic.TrackMenuReplacement.prototype.trackMenuItemListReplacement = function (popover, trackRenderer, hicBrowser) {

        var menuItems = [],
            all;

        menuItems.push(
            igv.trackMenuItem(
                popover,
                trackRenderer,
                "Set track name",
                function () {
                    return "Track Name"
                },
                trackRenderer.track.name,
                function () {

                    var alphanumeric = parseAlphanumeric(igv.dialog.$dialogInput.val());

                    if (undefined !== alphanumeric) {
                        trackRenderer.$label.text(alphanumeric);
                    }

                    function parseAlphanumeric(value) {

                        var alphanumeric_re = /(?=.*[a-zA-Z].*)([a-zA-Z0-9 ]+)/,
                            alphanumeric = alphanumeric_re.exec(value);

                        return (null !== alphanumeric) ? alphanumeric[0] : "untitled";
                    }

                },
                undefined));

        all = [];
        if (trackRenderer.track.menuItemList) {
            all = menuItems.concat( igv.trackMenuItemListHelper(trackRenderer.track.menuItemList(popover)) );
        }

        all.push(
            igv.trackMenuItem(
                popover,
                trackRenderer,
                "Remove track",
                function () {
                    var label = "Remove " + trackRenderer.track.name;
                    return '<div class="igv-dialog-label-centered">' + label + '</div>';
                },
                undefined,
                function () {
                    popover.hide();
                    hicBrowser.layoutController.removeTrackRendererPair(trackRenderer.trackRenderPair);
                },
                true));

        return all;
    };

    hic.TrackMenuReplacement.prototype.trackMenuItemReplacement = function (popover, trackRenderer, menuItemLabel, dialogLabelHandler, dialogInputValue, dialogClickHandler, doAddTopBorder) {

        var $e,
            clickHandler;

        $e = $('<div>');

        if (true === doAddTopBorder) {
            $e.addClass('igv-track-menu-border-top');
        }

        $e.text(menuItemLabel);


        clickHandler = function(){

            var $element;

            // $element = $(trackRenderer.trackDiv);
            $element = trackRenderer.$viewport;

            igv.dialog.configure(dialogLabelHandler, dialogInputValue, dialogClickHandler);
            igv.dialog.show($element);
            popover.hide();
        };

        $e.click(clickHandler);

        return { object: $e, init: undefined };
    };


    return hic;
})(hic || {});

