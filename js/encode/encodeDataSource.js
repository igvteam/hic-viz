/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016-2017 The Regents of the University of California
 * Author: Jim Robinson
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

/**
 * Created by dat on 4/18/17.
 */
var igv = (function (igv) {

    igv.EncodeDataSource = function (config) {
        this.config = config;
    };

    igv.EncodeDataSource.prototype.loadJSON = function (continuation) {

        this.jSON = {};
        if (this.config.filePath) {
            this.ingestFile(this.config.filePath, continuation);
        } else if (this.config.jSON) {
            this.ingestJSON(this.config.jSON, continuation);
        }

    };

    igv.EncodeDataSource.prototype.ingestJSON = function (json, continuation) {

        var self = this;

        self.jSON = json;

        json.rows.forEach(function(row, i){

            Object.keys(row).forEach(function(key){
                var item = row[ key ];
                self.jSON.rows[ i ][ key ] = (undefined === item || "" === item) ? "-" : item;
            });

        });

        continuation();

    };

    igv.EncodeDataSource.prototype.ingestFile = function (file, continuation) {

        var self = this;

        igvxhr.loadString(file).then(function (data) {

            var lines = data.splitLines(),
                item;

            // Raw data items order:
            // path | cell | dataType | antibody | view | replicate | type | lab | hub
            //
            // Reorder to match desired order. Discard hub item.
            //
            self.jSON.columns = lines[0].split("\t");
            self.jSON.columns.pop();
            item = self.jSON.columns.shift();
            self.jSON.columns.push(item);

            self.jSON.rows = [];

            lines.slice(1, lines.length - 1).forEach(function (line) {

                var tokens,
                    row;

                tokens = line.split("\t");
                tokens.pop();
                item = tokens.shift();
                tokens.push(item);

                row = {};
                tokens.forEach(function (t, i, ts) {
                    var key = self.jSON.columns[ i ];
                    row[ key ] = (undefined === t || "" === t) ? "-" : t;
                });

                self.jSON.rows.push(row);

            });

            continuation();
        });

    };

    igv.EncodeDataSource.prototype.dataTablesData = function () {

        var self = this,
            result = [];

        this.jSON.rows.forEach(function(row, index){

            var rr = [];

            rr.push( index );
            self.jSON.columns.forEach(function(key){
                rr.push( row[ key ] );
            });

            result.push( rr );
        });

        return result;
    };

    igv.EncodeDataSource.prototype.columnHeadings = function () {

        var columnWidths = this.jSON.columnWidths,
            columnHeadings = [ ];

        columnHeadings.push({ "title": "index" });
        this.jSON.columns.forEach(function(heading, i){
            //columnHeadings.push({ "title": heading, width: (columnWidths[ i ].toString() + "%") });
            columnHeadings.push({ "title": heading });
        });

        return columnHeadings;

    };

    return igv;

})(igv || {});
