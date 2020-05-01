var EventEmitter = require('events').EventEmitter
var puppeteer = require('puppeteer')
var asyncjs = require('async')
var assert = require('assert')
var URL = require('url').URL
var debug = require('debug')

module.exports = Robot

function Robot() {
    if (!(this instanceof Robot)) return new Robot()

    this.debugVisited = debug('puppeteer-robot:visited')
    this.debugError = debug('puppeteer-robot:error')
    this.debugEnd = debug('puppeteer-robot:end')

    EventEmitter.call(this)
}

Robot.prototype = Object.create(EventEmitter.prototype)

Robot.prototype.run = async function (initialHref) {
    assert.equal(typeof initialHref, 'string', 'puppeteer-robot.run: initialHref needs to be type string')

    var url = new URL(initialHref)
    assert.ok(url.protocol, 'puppeteer-robot.run: a URL needs to come with a protocol, i.e. https')

    var initialHost = url.hostname
    var visited = new Set()

    try {
        var browser = await puppeteer.launch({
            ignoreHTTPSErrors: true,
            acceptInsecureCerts: true,
            args: ['--proxy-bypass-list=*', '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-first-run', '--no-sandbox', '--no-zygote', '--single-process', '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list', '--enable-features=NetworkService']
        })
        var page = await browser.newPage()
    } catch (err) {
        this.emit('error', err)
    }

    var queue = asyncjs.queue(async (href) => {
        let nHash = href.indexOf('#')
        // remove characters after #
        href = href.substring(0, nHash !== -1 ? nHash : href.length)
        nHash = href.indexOf('?')
        // remove characters after ?
        href = href.substring(0, nHash !== -1 ? nHash : href.length)
        if (!visited.has(href)) {
            try {
                const response = await page.goto(href, {
                    // waitUntil: 'networkidle2'
                    waitUntil: 'load',
                    timeout: 0
                });
                this.debugVisited(href);
                visited.add(href);
                page.requestedHref = href;
                page.headers = response.headers();
                page.status = response.status();

                if (Robot.enableLighthouse) {
                    var lighthouse = require('lighthouse')
                    const reportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
                    const fs = require('fs');
                    
                    // Start Lighthouse
                    let opts = {
                        // chromeFlags: ['--headless'],
                        // logLevel: 'info',
                        output: 'json',
                        disableDeviceEmulation: true,
                        defaultViewport: {
                            width: 1200,
                            height: 900
                        },
                        chromeFlags: ['--disable-mobile-emulation'], 
                        enableErrorReporting: true
                    };

                    opts.port = (new URL(browser.wsEndpoint())).port;

                    let lighthouseResults = await lighthouse(href, opts, {
                        extends: 'lighthouse:default',
                        settings: {
                            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
                            throttlingMethod: 'devtools'
                        },
                    }).then(results => {
                        return results;
                    });
                    const html = reportGenerator.generateReport(lighthouseResults.lhr, 'html');
                    const json = reportGenerator.generateReport(lighthouseResults.lhr, 'json');
                    page.lighthouse = lighthouseResults.lhr
                    // Write report html to the file
                    fs.writeFile(`reports/data/${generateNameFromUrl(href)}.html`, html, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });

                    // Write report json to the file
                    fs.writeFile(`reports/data/${generateNameFromUrl(href)}.json`, json, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                    page.audits = {
                        jsonFilename: `${generateNameFromUrl(href)}.json`,
                        htmlFilename: `${generateNameFromUrl(href)}.html`,
                        interactive: lighthouseResults.lhr.audits.interactive.displayValue
                    }
                }

                var emitPage = new Promise((resolve, reject) => {
                    this.emit('page', page, resolve, push)

                    function push(url) {
                        queue.push(escape(url))
                    }
                })

                await emitPage

                var newHrefs = await page.$$eval('a', function (anchors) {
                    const ignoreValues = ['#', 'javascript:void(0)'];
                    return anchors.filter(anchor => anchor.href && ignoreValues.indexOf(anchor.href) === -1).map(anchor => anchor.href)
                })

                queue.push(newHrefs
                    .filter(link => link.match(new RegExp(initialHost, 'gi')))
                    .map(escape))
            } catch (err) {
                this.debugError(err)
                this.emit('error', err)
            }
        }
    })

    queue.drain = async () => {
        try {
            await browser.close()
            this.debugEnd('end')
            this.emit('end')
        } catch (err) {
            this.emit('error', err)
        }
    }

    queue.push(escape(initialHref))

    function escape(url) {
        return url.replace(/\/$/, '')
    }
}

Robot.prototype.on = function (event, cb) {
    assert.equal(typeof event, 'string', 'puppeteer-robot.on: event should be type string')
    if (event === 'page') {
        assert.equal(cb.constructor.name, 'AsyncFunction', 'puppeteer-robot.on: cb should be an AsyncFunction')

        var self = this
        EventEmitter.prototype.on.call(this, event, async function (page, resolve, push) {
            try {
                await cb(page, push)
            } catch (err) {
                self.debugError(err)
                self.emit('error', err)
            }
            resolve()
        })
    } else {
        EventEmitter.prototype.on.call(this, event, cb)
    }
}

Robot.prototype.enableLighthouse = enable => {
    assert.equal(typeof enable, 'boolean', 'puppeteer-robot.enableLighthouse: enable should be type boolean')
    Robot.enableLighthouse = enable
}

function generateNameFromUrl(url) {
    let uniqueName = url.replace(/\./g, "_").replace(/:/g, "_").replace(/\//g, '_')
    return uniqueName;
}
