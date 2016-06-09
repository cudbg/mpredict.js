# MPredict.js

A JavaScript library for realtime mouse position prediction

## Usage
MPredict.js can be added to your web page in the three steps:

**1)** Include `mpredict.js` in your page.

**2)** Put `mpredict-templates.json` in the same directory as the HTML file that includes 'mpredict.js'

**3)** Call this JavaScript function:
```javascript
mPredict.start();
````

You can pass one object parameter to `start` function to set the options.

**For example** `mPredict.start({'pathToTemplates': '../data/templates.json', 'targetElement': '#main-container'})` loads the template data from the given path rather than the default path above.

Then MPredict.js will automatically record the current mouse trace and sample it on the target DOM element(the document object by default)

## Demo
[Click here](https://cudbg.github.io/mpredict.js/prediction-demo.html) to see the demo of predicting mouse position. The black line is the current trace, the blue line is the predicted positions(10ms to 400ms in future), and the dynamic circle is the predicted endpoint.

## Documentation

###Options:

 - `sampleInterval`: The time interval(by milliseconds) of sampling the mouse trace; default: 10
 - `pauseThreshold`: The time threshold of pausing; when the time between two consecutive mouse events is larger than this threshold, the second mouse event will be regarded as the beginning of a new trace; default: 50
 - `K`: The number of nearest neighbors in the KNN algorithm; default: 5
 - `pathToTemplates`: The path to the JSON file of templates used for the KNN algorithm; default: '/mpredict-templates.json'
 - `targetElement`: The selector of target element to record mouse trace from

### API

####mPredict.start(options)

Start the introduction for defined element(s).

**Parameters:**
 - options :  Object(optional)
                Object that contains option keys with values.

**Returns:**
 - mPredict object.

**Example:**
```javascript
mPredict.start({
    'pathToTemplates': '../data/templates.json',
    'targetElement': '#main-container'
})
````
-----

####mPredict.getCurrentTrace()

Get the current mouse trace recorded and sampled by MPredict.js on the target DOM element

**Parameters:**
 - None

**Returns:**
 - Array: [[x0, y0, t0], ..., [xn, yn, tn]], xi and yi are mouse positions(in pixels), t0 is always 0(ms)

**Example:**
```javascript
var curTrace = mPredict.getCurrentTrace()
````
-----

####mPredict.sampleTrace(trace)

Sample a mouse trace for prediction

**Parameters:**
 - trace :  Array: `[[x0, y0, t0], ..., [xn, yn, tn]]`, xi and yi are mouse positions(in pixels), ti is the timestamp

**Returns:**
 - Array: `[[x0, y0, t0], ..., [xn, yn, tn]]`, xi and yi are mouse positions(in pixels), t0 is always 0(ms)

**Example:**
```javascript
var sampledTrace = mPredict.sampleTrace(unsampledTrace)
````
-----

####mPredict.predictPosition(trace, deltaTime)

Predict the mouse position for the given trace after deltaTime

**Parameters:**
 - trace : sampled mouse trace
 - deltaTime : integer(in milliseconds), deltaTime <= 0 means predicting the endpoint for the given trace

**Returns:**
 - Array: `[x, y]` (in pixels)

**Example:**
```javascript
mPredict.predictPosition(mPredict.getCurrentTrace(), 0)

````
-----