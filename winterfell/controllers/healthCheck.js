var http = require('http-status-codes');
var Log = require('../middlewares/log');

/*
  This endpoint servers to check that the app web server is responding
  to requests as expected.
  Send a GET request to http://hostname:port/healthz
  and you should get a 200 (OK) status.
*/
module.exports = function (app) {
  app.get('/api/healthz', function (req, res) {
    Log.console('health OK!');
    res.sendStatus(http.OK);
  });
};
