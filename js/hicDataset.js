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

    hic.Dataset = function (hicReader) {
        this.hicReader = hicReader;
        this.url = hicReader.path;
        this.matrixCache = {};
        this.blockCache = {};
        this.normVectorCache = {};
    };

    hic.Dataset.prototype.clearCaches = function () {
        this.matrixCache = {};
        this.blockCache = {};
        this.normVectorCache = {};

    };


    hic.Dataset.prototype.getMatrix = function (chr1, chr2) {

        var self = this,
            reader = this.hicReader,
            key = "" + chr1 + "_" + chr2;
        if (this.matrixCache.hasOwnProperty(key)) {
            return Promise.resolve(self.matrixCache[key]);
        } else {
            return new Promise(function (fulfill, reject) {
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


    hic.Dataset.prototype.getNormalizedBlock = function (zd, blockNumber, normalization) {

        var self = this;

        return new Promise(function (fulfill, reject) {

            self.getBlock(zd, blockNumber)

                .then(function (block) {

                    if (normalization === undefined || "NONE" === normalization) {
                        fulfill(block);
                    }
                    else {

                        var promises = [
                            self.getNormalizationVector(normalization, zd.chr1.name, zd.zoom.unit, zd.zoom.binSize),
                            self.getNormalizationVector(normalization, zd.chr2.name, zd.zoom.unit, zd.zoom.binSize)];

                        Promise.all(promises)
                            .then(function (vectors) {

                                var nv1 = vectors[0].data,
                                    nv2 = vectors[1].data,
                                    normRecords = [],
                                    normBlock;

                                block.records.forEach(function (record) {

                                    var x = record.bin1,
                                        y = record.bin2,
                                        counts,
                                        nvnv = nv1[x] * nv2[y];

                                    if (nvnv[x] !== 0 && !isNaN(nvnv)) {
                                        counts = record.counts / nvnv;
                                    } else {
                                        counts = NaN;
                                    }
                                    normRecords.push(new hic.ContactRecord(x, y, counts));

                                })

                                normBlock = new hic.Block(blockNumber, zd, normRecords);   // TODO - cache this?

                                fulfill(normBlock);
                            })
                            .catch(reject);


                    }
                })
                .catch(reject);
        })
    }

    hic.Dataset.prototype.getBlock = function (zd, blockNumber) {

        var self = this,
            key = "" + zd.chr1.name + "_" + zd.chr2.name + "_" + zd.zoom.binSize + "_" + zd.zoom.unit + "_" + blockNumber;

        if (this.blockCache.hasOwnProperty(key)) {
            return Promise.resolve(this.blockCache[key]);
        } else {
            return new Promise(function (fulfill, reject) {

                var reader = self.hicReader;

                reader.readBlock(blockNumber, zd)
                    .then(function (block) {

                        self.blockCache[key] = block;

                        fulfill(block);

                    })
                    .catch(reject)
            })
        }
    };

    hic.Dataset.prototype.getNormalizationVector = function (type, chrIdx, unit, binSize) {

        var self = this,
            key = hic.getNormalizationVectorKey(type, chrIdx, unit, binSize);


        if (this.normVectorCache.hasOwnProperty(key)) {
            return Promise.resolve(this.normVectorCache[key]);
        } else {
            return new Promise(function (fulfill, reject) {

                var reader = self.hicReader;

                reader.readNormalizationVector(type, chrIdx, unit, binSize)

                    .then(function (nv) {

                        self.normVectorCache[key] = nv;

                        fulfill(nv);

                    })
                    .catch(reject)
            })
        }
    };

    hic.Block = function (blockNumber, zoomData, records) {
        this.blockNumber = blockNumber;
        this.zoomData = zoomData;
        this.records = records;
    };


    hic.ContactRecord = function (bin1, bin2, counts) {
        this.bin1 = bin1;
        this.bin2 = bin2;
        this.counts = counts;
    };


    return hic;

})
(hic || {});
