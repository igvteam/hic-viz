/*
 *  The MIT License (MIT)
 *
 * Copyright (c) 2016-2020 The Regents of the University of California
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

import * as hic from './hicUtils.js'
import Straw from '../node_modules/hic-straw/src/straw.js'

const knownGenomes = {

    "hg19": [249250621, 243199373, 198022430],
    "hg38": [248956422, 242193529, 198295559],
    "mm10": [195471971, 182113224, 160039680],
    "mm9": [197195432, 181748087, 159599783],
    "dm6": [23513712, 25286936, 28110227]

}

class Dataset {

    constructor(config) {
        this.straw = new Straw(config)
    }

    async init() {

        this.hicFile = this.straw.hicFile;
        await this.hicFile.init();
        this.matrixCache = {};
        this.blockCache = {};
        this.blockCacheKeys = [];
        this.normVectorCache = {};
        this.normalizationTypes = ['NONE'];

        // Cache at most 10 blocks
        this.blockCacheLimit = hic.isMobile() ? 4 : 10;

        this.genomeId = this.hicFile.genomeId
        this.chromosomes = this.hicFile.chromosomes
        this.bpResolutions = this.hicFile.bpResolutions
        this.wholeGenomeChromosome = this.hicFile.wholeGenomeChromosome
        this.wholeGenomeResolution = this.hicFile.wholeGenomeResolution

        // Attempt to determine genomeId if not recognized
        if (!Object.keys(knownGenomes).includes(this.genomeId)) {
            const tmp = matchGenome(this.chromosomes);
            if (tmp) this.genomeId = tmp;
        }
    }

    async getContactRecords(normalization, region1, region2, units, binsize) {
        return this.straw.getContactRecords(normalization, region1, region2, units, binsize)
    }

    async hasNormalizationVector(type, chr, unit, binSize) {
        return this.straw.hicFile.hasNormalizationVector(type, chr, unit, binSize);
    }

    clearCaches() {
        this.matrixCache = {};
        this.blockCache = {};
        this.normVectorCache = {};
        this.colorScaleCache = {};
    }

    async getMatrix(chr1, chr2) {
        if (chr1 > chr2) {
            const tmp = chr1
            chr1 = chr2
            chr2 = tmp
        }
        const key = `${chr1}_${chr2}`

        if (this.matrixCache.hasOwnProperty(key)) {
            return this.matrixCache[key];

        } else {
            const matrix = await this.hicFile.readMatrix(chr1, chr2)
            this.matrixCache[key] = matrix;
            return matrix;

        }
    }

    getZoomIndexForBinSize(binSize, unit) {
        var i,
            resolutionArray;

        unit = unit || "BP";

        if (unit === "BP") {
            resolutionArray = this.bpResolutions;
        } else if (unit === "FRAG") {
            resolutionArray = this.fragResolutions;
        } else {
            throw new Error("Invalid unit: " + unit);
        }

        for (i = 0; i < resolutionArray.length; i++) {
            if (resolutionArray[i] === binSize) return i;
        }

        return -1;
    }

    getBinSizeForZoomIndex(zoomIndex, unit) {
        var i,
            resolutionArray;

        unit = unit || "BP";

        if (unit === "BP") {
            resolutionArray = this.bpResolutions;
        } else if (unit === "FRAG") {
            resolutionArray = this.fragResolutions;
        } else {
            throw new Error("Invalid unit: " + unit);
        }

        return resolutionArray[zoomIndex];
    }

    getChrIndexFromName(chrName) {
        var i;
        for (i = 0; i < this.chromosomes.length; i++) {
            if (chrName === this.chromosomes[i].name) return i;
        }
        return undefined;
    }

    compareChromosomes(otherDataset) {
        const chrs = this.chromosomes;
        const otherChrs = otherDataset.chromosomes;
        if (chrs.length !== otherChrs.length) {
            return false;
        }
        for (let i = 0; i < chrs.length; i++) {
            if (chrs[i].size !== otherChrs[i].size) {
                return false;
            }
        }
        return true;
    }

    isWholeGenome(chrIndex) {
        return (this.wholeGenomeChromosome != null && this.wholeGenomeChromosome.index === chrIndex);
    }


    async getNormVectorIndex() {
        return this.hicFile.getNormVectorIndex()
    }

    async getNormalizationOptions() {
        return this.hicFile.getNormalizationOptions()
    }
}

const Block = function (blockNumber, zoomData, records) {
    this.blockNumber = blockNumber;
    this.zoomData = zoomData;
    this.records = records;
};

class ContactRecord {
    constructor(bin1, bin2, counts) {
        this.bin1 = bin1;
        this.bin2 = bin2;
        this.counts = counts;
    }

    getKey() {
        return "" + this.bin1 + "_" + this.bin2;
    }
}


function matchGenome(chromosomes) {


    var keys = Object.keys(knownGenomes),
        i, l;

    if (chromosomes.length < 4) return undefined;

    for (i = 0; i < keys.length; i++) {
        l = knownGenomes[keys[i]];
        if (chromosomes[1].size === l[0] && chromosomes[2].size === l[1] && chromosomes[3].size === l[2]) {
            return keys[i];
        }
    }

    return undefined;


}

export default Dataset
