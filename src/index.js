const Robot = require('./helpers/Robot')
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const webpage = argv._[0]

fs.readdir('reports/data', (err, files) => {
    if (err) throw err;

    for (const file of files) {
        fs.unlink(path.join('reports/data', file), err => {
            if (err) throw err;
        });
    }
});

fs.writeFile('reports/datareports.json', '{"data": []}', () => {
    console.log('datareports.json created');
})

let robot = Robot()

robot.on('end', () => console.log('finished walking'))
robot.on('error', err => console.error('error', err))
robot.on('page', async (page) => {

    const title = await page.title()
    const cUrl = await page.url()
    // Misc
    const headers = page.headers;
    // const headersNew = await page.headers
    const status = page.status
    const description = await page.$eval("head > meta[name='description']", element => element ? element.content : '')
    const canonicalURL = await page.$eval("head > link[rel='canonical']", element => element ?  element.href : '')

    console.log(`---------------------------`)
    console.log(`title: ${title} => ${cUrl}`)

    let content = {
        title,
        url: page.requestedHref,
        redirectUrl: '',
        canonicalURL,
        perfScore: '',
        accScore: '',
        bpScore: '',
        seoScore: '',
        fileName: '',
        description: '',
        headers,
        status
    };
    if(page.lighthouse) {
        content = {
            title,
            url: page.requestedHref,
            redirectUrl: cUrl,
            canonicalURL,
            perfScore: page.lighthouse.categories.performance.score,
            accScore: page.lighthouse.categories.accessibility.score,
            bpScore: page.lighthouse.categories['best-practices'].score,
            seoScore: page.lighthouse.categories.seo.score,
            fileName: page.audits.htmlFilename,
            description: description,
            headers,
            status
        };
    }

    fs.readFile('reports/datareports.json', (err, data) => {
        const json = JSON.parse(data)
        json.data.push(content)

        fs.writeFile('reports/datareports.json', JSON.stringify(json), function (err) {
            if (err) return console.error(err);
        })
    })

})

robot.enableLighthouse(true)

robot.run(webpage)
