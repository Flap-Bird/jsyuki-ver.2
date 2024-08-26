const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');
const Cache = require('./cache.js'); // キャッシュ機能のインポート

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_API_WAIT_TIME = 3000;
const APIS = [
"https://youtube.076.ne.jp/",
"https://vid.puffyan.us/",
"https://invidious.jing.rocks/",
];

const cache = new Cache(60); // TTLを60秒に設定

app.use(express.static(path.join(__dirname, 'css')));
app.use('/blog', express.static(path.join(__dirname, 'blog')));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

function isJson(str) {
try {
JSON.parse(str);
return true;
} catch {
return false;
}
}

async function apirequest(api, url) {
try {
const response = await axios.get(api + url, { timeout: MAX_API_WAIT_TIME });
if (response.status === 200 && isJson(response.data)) {
return response.data;
}
} catch (error) {
console.error('Request failed:', error.message);
}
return null;
}

const cachedApirequest = cache.wrap(apirequest); // キャッシュを使ったAPIリクエスト

app.get('/', (req, res) => {
const yuki = req.cookies.yuki;
if (yuki !== 'True') {
return res.redirect('/blog');
}
res.cookie('yuki', 'True', { maxAge: 60 * 60 * 24 * 7 * 1000 });
res.render('home');
});

app.get('/watch', async (req, res) => {
const { v: videoid, proxy } = req.query;
const yuki = req.cookies.yuki;

if (yuki !== 'True') {
return res.redirect('/');
}

res.cookie('yuki', 'True', { maxAge: 7 * 24 * 60 * 60 * 1000 });
try {
const data = await getData(videoid);
res.render('video', {
videoid,
videourls: data[1],
res: data[0],
description: data[2],
videotitle: data[3],
authorid: data[4],
authoricon: data[6],
author: data[5],
proxy
});
} catch (error) {
console.error('Data retrieval failed:', error.message);
res.status(500).send('Failed to retrieve data');
}
});

async function getData(videoid) {
const apiResponse = await cachedApirequest(APIS[0], `api/v1/videos/${encodeURIComponent(videoid)}`);
if (apiResponse) {
try {
const t = apiResponse;
return [
t.recommendedVideos.map(i => ({
id: i.videoId || "",
title: i.title || "",
authorId: i.authorId || "",
author: i.author || ""
})),
t.formatStreams.map(i => i.url || "").reverse().slice(0, 2),
(t.descriptionHtml || "").replace(/\n/g, "<br>"),
t.title || "",
t.authorId || "",
t.author || "",
(t.authorThumbnails || [{}]).slice(-1)[0].url || ""
];
} catch (error) {
throw new Error("Failed to decode JSON response");
}
}
throw new Error("Failed to get a valid response from API");
}

app.listen(PORT, () => {
console.log(`Server is running on http://localhost:${PORT}`);
});
