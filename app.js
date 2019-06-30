const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const request = require('request');

var app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

var server = require('http').createServer(app);
server.listen(process.env.PORT || 3000);

var settingsPC = null;
var displaySettingsPC = null;
var totalPrice = 0;
var websitePriceClass = {
    'gearvn.com': '.product_sale_price',
    'www.memoryzone.com.vn': '[itemprop="offers"] .special-price > .product-price',
    'tandoanh.vn': '#price-preview > span',
    'tanthanhdanh.vn': '.text-price',
    'hotgear.vn': '#pdPriceNumber',
    'xgear.vn': '[itemprop="offers"] .woocommerce-Price-amount',
    'tinhocngoisao.com': '.price-promo'
}

app.get('/', function (req, res) {
    loadSettings();
    displayPCSetting();

    res.render('main-menu', { displaySettingsPC, totalPrice });
})

app.get('/setting-menu', function (req, res) {
    loadSettings();
    res.render('setting-menu', { settingsPC });
})

app.post('/save-setting', function (req, res) {
    var params = req.body;
    for (let index = 0; index < settingsPC.length; index++) {
        settingsPC[index].name = params.name[index];
        settingsPC[index].image = params.image[index];
        settingsPC[index].link = params.link[index];
        settingsPC[index].price = params.price[index];
    }
    updateSettings(settingsPC);
    displayPCSetting();
    res.redirect('/');
})

app.get('/update-price', function (req, res) {
    crawlerPriceData(res);
})

function loadSettings() {
    if (settingsPC === null) {
        let settingRawData = fs.readFileSync('settings.json');
        settingsPC = JSON.parse(settingRawData);
    }
}

function updateSettings(setting) {
    fs.writeFile("settings.json", JSON.stringify(setting), function (err) {
        if (err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    });
}

function countTotal() {
    totalPrice = 0;
    for (const item of settingsPC) {
        totalPrice += Number(item.price);
    }
    return formatNumber(totalPrice);
}

function formatNumber(number) {
    var num = Number(number)
    return num.toLocaleString() + ' đ';
}

function displayPCSetting() {
    displaySettingsPC = JSON.parse(JSON.stringify(settingsPC));

    totalPrice = countTotal();
    for (let index = 0; index < displaySettingsPC.length; index++) {
        var newPrice = displaySettingsPC[index].price;
        var oldPrice = displaySettingsPC[index].old_price;
        displaySettingsPC[index].price = formatNumber(newPrice);
        if(oldPrice !== newPrice) {
            displaySettingsPC[index].old_price = formatNumber(oldPrice);
        } else {
            displaySettingsPC[index].old_price = '';
        }
    }
}

function crawlerPriceData(res, index = 0) {
    var response = res;
    var currentIndex = index;
    if (currentIndex === settingsPC.length) {
        updateSettings(settingsPC);
        res.redirect('/');
        return;
    }

    var link = settingsPC[currentIndex].link;
    var website = getWebsite(link);
    var priceClassWebsite = websitePriceClass[website];
    request({ url: link, timeout: 60000 }, function (err, res, body) {
        if (err) {
            console.log(err);
            return;
        }
        //  Sử dụng cheerio.load để lấy dữ liệu trả về
        var $ = cheerio.load(body);
        var rawPrice = $(priceClassWebsite).text().trim();
        var newPrice = convertPrice(rawPrice);

        settingsPC[index].old_price = settingsPC[index].price;
        settingsPC[index].price = newPrice;
        crawlerPriceData(response, currentIndex + 1);
    })
}

function getWebsite(url) {
    var website = String(url).split('/');
    return website[2];
}

function convertPrice(priceString) {
    if (!priceString) {
        return;
    }
    return String(priceString).match(/\d/g).join('');
}