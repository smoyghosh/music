const config = require("./config");
const server = require("./server");
var app = {};
app.init = function () {
  server.init(config);
};
app.init();
module.exports = app;
