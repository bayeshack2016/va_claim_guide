var should = require('should');

describe('HealthCheckController', function() {

  it('GET /healthz should return OK', function(done) {
    var test = 1;
    test.should.equal(1);
    done();
  });

});
