/**
 * MPredict.js v1.1.5
 * https://github.com/cudbg/mpredict.js
 * MIT licensed
 *
 * Copyright (C) 2016 - by Zhengjie Miao (@J-Miao)
 */


(function (root, factory) {
    if (typeof exports === 'object') {
        // CommonJS
        factory(exports);
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['exports'], factory);
    } else {
        // Browser globals
        factory(root);
    }
} (this, function (exports) {
    //Default config/variables
    var VERSION = '1.1.5';
    var _templates;
    var _curTrace = [];
    var _options = {
        sampleInterval: 10,
        pauseThreshold: 50,
        K: 5,
        pathToTemplates: './mpredict-templates.json',
        targetElement: 'document'
    };

    function _calcDist(x1, y1, x2, y2) {
        return Math.sqrt((x1-x2)*(x1-x2) + (y1-y2)*(y1-y2));
    }

    function _dotProduct(v1, v2) {
        return v1[0] * v2[0] + v1[1] * v2[1];
    }

    /**
     * Scalar projection of v1 onto v2
     *
     * @api private
     * @method _project
     */
    function _project(v1, v2) {
        var v2Len = _calcDist(v2[0], v2[1], 0, 0);
        if (v2Len < 1e-8) {
            return null;
        }
        var r = _dotProduct(v1, v2) / (v2Len * v2Len);
        return [r * v2[0], r * v2[1]]
    }

    /**
     * Calculaye the perpendicular from p to vector v
     *
     * @api private
     * @method _perpendicular
     */
    function _perpendicular(p, v) {
        var v2p = [p[0] - v[0], p[1] - v[1]];
        var vLen = _calcDist(v[0], v[1], 0, 0);
        var r = _dotProduct(v2p, v) / (vLen * vLen);
        return [r * v[0], r * v[1]];
    }

    /**
     *  main class
     *
     * @class MPredict
     */
    var mPredict = {};

    /**
     * Add a point to current trace
     *
     * @api private
     * @method _addPoint
     */
    function _addPoint(point, trace) {

        if (trace.length > 0 && (point[2] < trace[trace.length-1][2]
            || point[2] > trace[trace.length-1][2] + _options.pauseThreshold)) {
            trace = [];
        }
        if (trace.length > 0) {
            var dist0 = _calcDist(trace[0][0], trace[0][1], trace[trace.length-1][0], trace[trace.length-1][1]);
            var dist1 = _calcDist(trace[0][0], trace[0][1], point[0], point[1]);
            if (dist0 > dist1) {
                trace = [trace[trace.length-1]];
            }
        }

        if (trace.length === 0 || _options.sampleInterval === 0) {
            trace.push(point);
        }
        else {
            var l = trace.length;
            var timeDiff = point[2] - trace[l-1][2], rate = _options.sampleInterval / timeDiff;
            var x = trace[l-1][0], y = trace[l-1][1];
            while (timeDiff >= _options.sampleInterval) {
                trace.push([
                    trace[l-1][0] + rate * (point[0] - x),
                    trace[l-1][1] + rate * (point[1] - y),
                    trace[l-1][2] + _options.sampleInterval
                ]);
                timeDiff -= _options.sampleInterval;
                l++;
            }
        }

        return trace;
    }

    /**
     * Add a new trace
     *
     * @api private
     * @method _sampleTrace
     */
    function _sampleTrace(trace) {

        var newTrace = [];
        for (var i = 0; i < trace.length; i++) {
            newTrace = _addPoint(trace[i], newTrace);
        }
        return newTrace;
    }

    /**
     * Calculate the matching score of current velocity profile and the template velocity profile
     *
     * @api private
     * @method _calcScore
     */
    function _calcScore(cVAP, tVAP, tLbos) {

        var cLen = cVAP.length, tLen = tVAP.length;
        if (tLbos !== -1) {
            tLen = Math.max(tLbos - 2, 1);
        }

        var res = 0.0;
        if (cLen <= tLen) {
            for (var i = 0; i < cLen; i++) {
                res += Math.abs(cVAP[i] - tVAP[i]);
            }
        }
        else {
            for (var i = 0; i < tLen; i++) {
                res += Math.abs(cVAP[i] - tVAP[i]);
            }
            for (var i = tLen; i < cLen; i++) {
                res += Math.abs(cVAP[i]);
            }
        }
        res /= cLen;
        return res;
    }

    /**
     * Decide whether the template is shorter than current velocity profle
     *
     * @api private
     * @method _getScore
     */
    function _getScore(current, template, delta, constraint) {
        if (constraint && constraint.length === 2) {
            return _calcScore(current['vp'], template['vp'], template['lbos']);
        }
        else {
            return _calcScore(current['vap'], template['vap'], template['lbos']);
        }
    }

    /**
     * predict the position for given trace and matched templates after delta time
     * delta <= 0 means predicting the endpoint
     *
     * @api private
     * @method _predictPoint
     */
    function _predictPoint(current, matchedTemplates, delta, constraint) {

        var n = current['vp'].length - 1;
        var predictPoints = [];
        var avgPoint = [0.0, 0.0, 0.0];

        matchedTemplates.forEach(function(d) {
            var pp;
            if (d['lbos'] === -1) {
                if (delta <= 0) {
                    if (d['vp'].length - n > 30) {
                        pp = _predictSinglePoint(current, d, n, 30, constraint);
                    }
                    else {
                        pp = _predictSinglePoint(current, d, n, d['trace'].length - n - 2, constraint);
                    }
                }
                else {
                    if (n + 2 + delta >= d['trace'].length) {
                        pp = _predictSinglePoint(current, d, n, d['trace'].length - n - 2, constraint);
                    }
                    else {
                        pp = _predictSinglePoint(current, d, n, delta, constraint);
                    }
                }
            }
            else {
                if (delta <= 0) {
                    if (d['lbos'] - n - 2 > 30) {
                        pp = _predictSinglePoint(current, d, n, 30, constraint)
                    }
                    else {
                        pp = _predictSinglePoint(current, d, n, d['lbos'] - n - 2, constraint)
                    }
                }
                else {
                    //if (n + 2 + delta >= d['trace'].length) {
                    if (n + 2 + delta >= d['lbos']) {
                        //pp = _predictSinglePoint(current, d, n, d['vp'].length - n);
                        pp = _predictSinglePoint(current, d, n, d['lbos'] - n - 2, constraint)

                    }
                    else {
                        pp = _predictSinglePoint(current, d, n, delta, constraint);
                    }
                }
            }
            predictPoints.push(pp);
            avgPoint[0] += pp[0];
            avgPoint[1] += pp[1];
        });

        avgPoint[0] /= predictPoints.length;
        avgPoint[1] /= predictPoints.length;
        var s = predictPoints.reduce(function(a, b) {
            return a + Math.pow(b[0]-avgPoint[0], 2) + Math.pow(b[1]-avgPoint[1], 2);
        }, 0);
        avgPoint[2] = Math.sqrt(s / predictPoints.length);

        return avgPoint;
    }

    /**
     * predict the position for the given trace on the direction of given constraint vector
     * and for one of the matched templates after delta time
     * delta <= 0 means predicting the endpoint
     *
     * @api private
     * @method _predictSinglePoint1D
     */

    function _predictSinglePoint1D(current, template, tempStart, tempLen, constraint) {
        var n = current['vp'].length - 1;
        var cTrace = current['trace'];
        var offset = 2;
        if (n + 3 !== cTrace.length) {
            offset = 1;
        }
        var p = [cTrace[n+offset][0], cTrace[n+offset][1]];
        //var projectedP = _perpendicular(p, constraint);
        var dist = 0.0;
        for (var i = 0; i < tempLen; i++) {
            dist += template['vp'][tempStart + i] * _options.sampleInterval;
        }
        var curV = [cTrace[n+offset][0] - cTrace[n][0], cTrace[n+offset][1] - cTrace[n][1]];
        if (_dotProduct(curV, constraint) < 0) {
            dist = -dist;
        }
        //return [projectedP[0] + dist * constraint[0], projectedP[1] + dist * constraint[1]];
        return [p[0] + dist * constraint[0], p[1] + dist * constraint[1]];
    }

    /**
     * predict the position for the given trace on 2-d plane and one of the matched templates after delta time
     * delta <= 0 means predicting the endpoint
     *
     * @api private
     * @method _predictSinglePoint2D
     */

    function _predictSinglePoint2D(current, template, tempStart, tempLen) {

        var n = current['vp'].length - 1;
        var cTrace = current['trace'];
        var offset = 2;
        if (n + 3 !== cTrace.length) {
            offset = 1;
        }

        var v0 = [cTrace[n+offset][0] - cTrace[n+offset-1][0], cTrace[n+offset][1] - cTrace[n+offset-1][1]];
        var p = [cTrace[n+offset][0], cTrace[n+offset][1]];
        var plist = [cTrace[n+offset-1], cTrace[n+offset]];
        for (var i = 0; i < tempLen; i++){
            var sn = Math.sin(template['ap'][tempStart + i]);
            var cs = Math.cos(template['ap'][tempStart + i]);
            var x = v0[0] * cs - v0[1] * sn;
            var y = v0[0] * sn + v0[1] * cs;
            var predDisp = [0.0, 0.0];
            if (Math.abs(x) < 1e-8 && Math.abs(y) < 1e-8) {
                predDisp = [0.0, 0.0]
            }
            else {
                if (Math.abs(x) < 1e-8) {
                    predDisp[0] = 0.0;
                    predDisp[1] = template['vp'][tempStart + i] * _options.sampleInterval;
                    if (y < 0) {
                        predDisp[1] = -predDisp[1]
                    }
                }
                else {
                    if (Math.abs(x) < 1e-8) {
                        predDisp[1] = 0.0;
                        predDisp[0] = template['vp'][tempStart + i] * _options.sampleInterval;
                        if (x < 0) {
                            predDisp[0] = -predDisp[0];
                        }
                    }
                    else {
                        predDisp[1] = y * template['vp'][tempStart + i] * _options.sampleInterval / Math.sqrt(x * x + y * y);
                        predDisp[0] = x * template['vp'][tempStart + i] * _options.sampleInterval / Math.sqrt(x * x + y * y);
                    }
                }
            }

            p[0] += predDisp[0];
            p[1] += predDisp[1];
            plist.push([0.0, 0.0]);
            plist[plist.length - 1][0] = p[0];
            plist[plist.length - 1][1] = p[1];
            v0[0] = plist[plist.length - 1][0] - plist[plist.length - 2][0];
            v0[1] = plist[plist.length - 1][1] - plist[plist.length - 2][1];
        }
        return p;
    }

    /**
     * predict the position for the given trace and one of the matched templates after delta time
     * delta <= 0 means predicting the endpoint
     *
     * @api private
     * @method _predictSinglePoint
     */

    function _predictSinglePoint(current, template, tempStart, tempLen, constraint) {
        if (constraint && constraint.length === 2) {
            return _predictSinglePoint1D(current, template, tempStart, tempLen, constraint)
        }
        else {
            return _predictSinglePoint2D(current, template, tempStart, tempLen);
        }
    }

    /**
     * Calculate velocity for given three points
     *
     * @api private
     * @method _calcVelocity
     */
    function _calcVelocity(pts, constraint) {

        var v = [0.0, 0.0];
        if (pts.length < 3) {
            return 0;
        }

        var t1 = pts[2][2] - pts[1][2];
        var t2 = pts[1][2] - pts[0][2];

        if (t1 === t2) {
            v[0] = pts[2][0] - pts[0][0];
            v[1] = pts[2][1] - pts[0][1];
            v[0] /= (2 * t1);
            v[1] /= (2 * t1);
        }
        else {
            v[0] = t1 * t1 * pts[2][0] - t2 * t2 * pts[0][0] - (t1 * t1 - t2 * t2) * pts[0][0];
            v[1] = t1 * t1 * pts[2][1] - t2 * t2 * pts[0][1] - (t1 * t1 - t2 * t2) * pts[0][1];
            v[0] /= (t1 * t1 * t2 - t2 * t2 * t1);
            v[1] /= (t1 * t1 * t2 - t2 * t2 * t1);
        }
        if (constraint && constraint.length === 2) {
            var projectedV = _project(v, constraint);
            return Math.sqrt(projectedV[0] * projectedV[0] + projectedV[1] * projectedV[1]);
        }
        else {
            return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        }
    }

    /**
     * Calculate turning angle for given three points
     *
     * @api private
     * @method _calcAngle
     */
    function _calcAngle(pts) {
        if (pts.length < 3) {
            return 0;
        }

        var v1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
        var v2 = [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]];
        var dot = _dotProduct(v1, v2);
        var det = v1[0] * v2[1] - v1[1] * v2[0];
        return Math.atan2(det, dot);
    }

    /**
     * Combining the velocity profile and the angle profile to measure distances between profiles
     *
     * @api private
     * @method _combineVA
     */
    function _combineVA(vp, ap) {

        var l = Math.min(vp.length, ap.length);
        var vap = [];
        for (var i = 0; i < l; i++) {
            var z = 1.0;
            if (ap[i] < 0) {
                z = -1.0;
            }
            vap.push(z * vp[i]);
        }

        return vap;
    }

    /**
     * Build velocity profile for given trace
     *
     * @api private
     * @method _buildVAP
     */
    function _buildVAP(trace, constraint) {

        var vap = {'trace': [], 'vp':[], 'ap': [], 'vap': []};
        var tLen = trace.length;
        vap['trace'] = trace;
        if (tLen < 2) {
            return vap;
        }
        else {
            if (constraint && constraint.length === 2) {
                if (tLen === 2) {
                    var v;
                    v = [
                        (trace[1][0] - trace[0][0]) / (trace[1][2] - trace[0][2]),
                        (trace[1][1] - trace[0][1]) / (trace[1][2] - trace[0][2])
                    ];
                    var projectedV = _project(v, constraint);
                    vap['vp'] = [Math.sqrt(projectedV[0] * projectedV[0] + projectedV[1] * projectedV[1])];
                    vap['ap'] = [0.0];
                    vap['vap'] = vap['vp']
                    return vap;
                }
                else {
                    for (var i = 2; i < trace.length; i++) {
                        var v = _calcVelocity([trace[i - 2], trace[i - 1], trace[i]], constraint);
                        var a = _calcAngle([trace[i - 2], trace[i - 1], trace[i]]);
                        vap['vp'].push(v);
                        vap['ap'].push(a);
                    }
                    vap['vap'] = _combineVA(vap['vp'], vap['ap']);
                    return vap;
                }

            }
            else {
                if (tLen === 2) {
                    var v;
                    v = [
                        (trace[1][0] - trace[0][0]) / (trace[1][2] - trace[0][2]),
                        (trace[1][1] - trace[0][1]) / (trace[1][2] - trace[0][2])
                    ];
                    vap['vp'] = [Math.sqrt(v[0] * v[0] + v[1] * v[1])];
                    vap['ap'] = [0.0];
                    vap['vap'] = vap['vp']
                    return vap;
                }
                else {
                    for (var i = 2; i < trace.length; i++) {
                        var v = _calcVelocity([trace[i - 2], trace[i - 1], trace[i]]);
                        var a = _calcAngle([trace[i - 2], trace[i - 1], trace[i]]);
                        vap['vp'].push(v);
                        vap['ap'].push(a);
                    }
                    vap['vap'] = _combineVA(vap['vp'], vap['ap']);
                    return vap;
                }
            }
        }
    }

    /**
     * Predict the cursor position for the given cursor trace after the given time
     * Predict the endpoint if the given time = 0
     *
     * @api private
     * @method _predictPosition
     */
    function _predictPosition(trace, delta, option) {
        if (option && option['constraint'] && option['constraint'].length === 2) {
            var contraintLen = _calcDist(option['constraint'][0], option['constraint'][1], 0, 0);
            if (contraintLen < 1e-8) {
                return null;
            }
            option['constraint'][0] /= contraintLen;
            option['constraint'][1] /= contraintLen;
        }

        var currentVAP;

        if (option && option.hasOwnProperty('type') && option['type'] === '1D') {
            currentVAP = _buildVAP(trace, option['constraint']);
        }
        else {
            currentVAP = _buildVAP(trace);
        }
        if (currentVAP['vap'].length === 0) {
            return null;
        }

        var scores;
        if (option && option.hasOwnProperty('type') && option['type'] === '1D') {
            scores = _templates.map(function (d) {
                return _getScore(currentVAP, d, delta, option['constraint']);
            });
        }
        else {
            scores = _templates.map(function (d) {
                return _getScore(currentVAP, d, delta);
            });
        }

        var minScore = new Array(_options.K).fill(1e10);
        var matchingVAP = new Array(_options.K).fill(-1);

        scores.forEach(function (d, i) {
            for (var j = 0; j < _options.K; j++) {
                if (d < minScore[j]) {
                    for (var k = _options.K - 1; k > j; k--) {
                        minScore[k] = minScore[k - 1];
                        matchingVAP[k] = matchingVAP[k - 1];
                    }
                    minScore[j] = d;
                    matchingVAP[j] = i;
                    break;
                }
            }
        });

        var matched = [];
        for (var i = 0; i < _options.K; i++) {
            matched.push(_templates[matchingVAP[i]]);
        }
        if (option && option.hasOwnProperty('type') && option['type'] === '1D') {
            return _predictPoint(currentVAP, matched, delta, option['constraint']);
        }
        else {
            return _predictPoint(currentVAP, matched, delta);
        }
    }
    /**
     * Start listening to the target DOM element
     *
     * @api private
     * @method _startRecording
     */
    function _startRecording() {
        var targetEle = document;
        if (_options.targetElement !== 'document') {
            targetEle = document.querySelector(_options.targetElement);
        }
        console.log(targetEle);
        targetEle.addEventListener('mousemove', function (e) {
            _curTrace = _addPoint.call(this, [e.pageX, e.pageY, Math.floor(Date.now())], _curTrace);
        });
        targetEle.addEventListener('mousedown', function () {
            _curTrace = [];
        });
        targetEle.addEventListener('mouseup', function () {
            _curTrace = [];
        });
    }

    // Load the library of templates
    var loadLocalFile = function (path, done) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open('GET', path, true);
        xmlhttp.onreadystatechange = function() {
            if (xmlhttp.readyState == 4) {
                if(xmlhttp.status == 200) {
                    done(JSON.parse(xmlhttp.responseText))
                }
            }
        };
        xmlhttp.send(null);
    };

    /**
     * Current MPredict version
     *
     * @property version
     * @type String
     */
    mPredict.version = VERSION;

    //mPredict.predictElement = function() {
    //    return this;
    //};

    mPredict.predictPosition = function(trace, deltaTime, option) {
        return _predictPosition(trace, deltaTime / _options.sampleInterval, option);
    };

    mPredict.sampleTrace = function(trace) {
        return _sampleTrace.call(this, trace)
    };

    mPredict.getCurrentTrace = function() {
        return _curTrace;
    };

    mPredict.start = function(options) {
        for (var attrname in options) {
            _options[attrname] = options[attrname];
        }

        loadLocalFile(_options.pathToTemplates, function(res) {
            _templates = res;
            return res;
        });

        function checkLoaded() {
            if (_templates == undefined) {
                // checks whether templates are loaded from the file every 100ms
                window.setTimeout(checkLoaded, 100);
            }
            else {
                _startRecording.call(this);
            }
        }
        checkLoaded();
    };

    exports.mPredict = mPredict;
    return mPredict;
}));