var express = require('express'),
    app = express(),
    sqlite3 = require('sqlite3'),
    util = require('util'),
    swig = require('swig'),
    fs = require('fs'),
    db = new sqlite3.Database(__dirname +'/data/nightmonkey.db'),
    router = express.Router(),
    port = process.env.PORT || 3000,
    gettext = new (require("node-gettext"))()

/**
 *  Nightmonkey config
 */
try {
    config = require('./config.json')
}
catch (e) {
    if (e.code == 'MODULE_NOT_FOUND') {
        console.warn('Config file is missing.')
    }
    else if (e.name == 'SyntaxError') {
        console.warn('Config file is corrupt.')
    }

    process.exit()
}

/**
 *  Nightmonkey tools
 */
function validateValue(queryValue, list) {
    if (!queryValue) {
        return Object.keys(list)[0]
    }
    
    if (!list[queryValue]) {
        return Object.keys(list)[0]
    }

    return queryValue
}

swig.setFilter('trans', function (input) {
    return gettext.gettext(input)
})

var f = util.format

function tableExists(tableName, callback) {
    db.get('SELECT name FROM sqlite_master WHERE type = "table" AND name = ?', [tableName], function(err, row) {
        if (err) {
            return
        }
        
        callback(row.name == tableName)
    })
}

/**
 *  gettext
 */
gettext.addTextdomain("hu", fs.readFileSync(__dirname +"/po/hu.po"));
gettext.textdomain("hu")

/**
 *  Express
 */
app.engine('twig', swig.renderFile);
app.set('view engine', 'twig');
app.set('views', __dirname +'/views');
app.set('view cache', false);
app.use(express.static(__dirname +'/public'));

/**
 *  Swig
 */
swig.setDefaults({ cache: false });

router.get('/', function(req, res, next) {
    db.get('SELECT MAX(value) max FROM popcon', function (err, row) {
        row = row || {max: 0}
        res.render('main.html.twig', {
            'config': config,
            'popconMax': row.max * 1
        })
    })
})

router.get('/search', function(req, res, next) {

    var release = validateValue(req.query.release, config.releases)
    var language = validateValue(req.query.language, config.languages)
    var repository = validateValue(req.query.repository, config.repositories)
    var packageStatus = validateValue(req.query.status, config.statuses)
    var view = validateValue(req.query.view, config.views)
    var packageName = req.query.packageName
    var tableName = [release, repository, language].join('_')
    var queryParts = []
    
    tableExists(tableName, function (found) {
        if (!found) {
            // TODO: 'error': 'table not found'
            res.json([])
            return
        }
        queryParts.push('SELECT t.rowid id, isApp, isOk status, longdescs, longdescsstat, t.package, shortdesc, shortdescstat, p.value popcon, r.value rate')
        queryParts.push(f('FROM %s t', tableName))
        queryParts.push('LEFT JOIN popcon p USING(package)')
        queryParts.push('LEFT JOIN rnr r USING(package)')

        if (packageStatus != 'all') {
            queryParts.push(f('AND isok %s', packageStatus))
        }
        if (packageStatus == 'view') {
            queryParts.push('AND isApp = "true"')
        }

        var rows = new Array
        var query = queryParts.join(' ')
        
        db.each(query, function(err, row) {
            if (!row.rate) {
                row.rate = 0
            }
            rows.push(row)
        }, function (err) {
            res.json(rows)
        })
    })
})

app.use('/', router);

var server = app.listen(port, function () {

  var host = server.address().address
  var port = server.address().port

  console.log('Nighmonkey app listening at http://%s:%s', host, port)

})
