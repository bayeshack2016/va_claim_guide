var _ = require('lodash');
var auth = require('../middlewares/auth');
var http = require('http-status-codes');
var httpErrors = require('./../utils/httpErrors');
var Claim = require('../models/claim');
var ClaimService = require('./../services/claimService');
var DocumentRenderingService = require('./../services/documentRenderingService');
var Form = require('../models/form');
var Q = require('q');
var MailingService = require('./../services/mailingService');
var mongoose = require('mongoose');
var User = require('../models/user');
var UserValues = require('../models/userValues');

module.exports = function (app) {
  var mw = [auth.authenticatedOr404];
  var mailingService = new MailingService(app);
  var documentRenderingService = new DocumentRenderingService(app);

  // Get all claims for a user
  app.get('/api/claims', mw, function (req, res) {
    User.findById(req.session.userId).exec(function(err, user) {
      if (err) {
        res.sendStatus(http.INTERNAL_SERVER_ERROR);
        return;
      }
      if (user) {
        Claim.find({userId: user._id}).exec(function(err, claims) {
          var extClaims = _.map(claims, function(c) {
            return c;
          });
          res.status(http.OK).send({claims: extClaims});
        });
      } else {
        res.status(http.NOT_FOUND).send({error: httpErrors.USER_NOT_FOUND});
      }
    });
  });

  // Get a particular claim
  app.get('/api/claim/:extClaimId', mw, function (req, res) {
    Claim.findOne({externalId: req.params.extClaimId}).exec(function(err, claim) {
      if (claim) {
        res.status(http.OK).send({claim: claim});
      } else {
        res.status(http.NOT_FOUND).send({error: httpErrors.CLAIM_NOT_FOUND});
      }
    });
  });

  app.post('/api/claims/create', mw, function (req, res) {
    var callback = function (err, claim) {
      if (claim) {
        res.status(http.CREATED).send({claim: claim});
      } else {
        res.status(http.INTERNAL_SERVER_ERROR).send({error: httpErrors.DATABASE});
      }
    };

    User.findById(req.session.userId).exec(function (userErr, user) {
      if (user) {
        ClaimService.findIncompleteClaimOrCreate(user._id,
          (req.body.forms || []),
          callback);
      } else {
        res.status(http.NOT_FOUND).send({error: httpErrors.USER_NOT_FOUND});
      }
    });
  });

  function handleClaimStateChange(extClaimId, claimState, callback) {
    Claim.findOne({externalId: extClaimId}, function(err, claim) {
      if (err) {
        callback(err, null);
        return;
      }
      if (claim) {
        ClaimService.setClaimState(claim._id, claimState, callback);
      } else {
        callback(null, null);
      }
    });
  }

  function claimUpdateCallbackFactory(res) {
    return function (err, claim) {
      if (err) {
        res.sendStatus(http.INTERNAL_SERVER_ERROR);
        return;
      }

      if (claim) {
        res.sendStatus(http.OK);
      } else {
        res.sendStatus(http.NOT_FOUND);
      }
    }
  }

  app.post('/api/claim/:extClaimId/submit', mw, function(req, res) {
    var that = this;
    var currentUser = null;
    var promise = User.findById(req.session.userId);

    promise = promise.then(function(user) {
      currentUser = user;
      return Claim.findOne({externalId: req.params.extClaimId});
    });

    promise = promise.then(function(claim) {
      if (!claim) {
        res.sendStatus(http.NOT_FOUND);
        return Q.defer().promise; // short circuit promise chain
      } else {
        that.claim = claim;
        return Form.find({claim: claim._id});
      }
    });

    promise = promise.then(function(documents) {
      return mailingService.sendLetter(
        currentUser,
        req.body.fromAddress,
        req.body.toAddress,
        documents
      );
    });

    promise = promise.then(function(letter) {
      that.letter = letter;
      return Claim.update({_id: that.claim._id}, {state: Claim.State.SUBMITTED})
    });

    promise.done(function success(claim) {
      res.status(http.OK).send({
        letter: that.letter,
        claim: claim
      });
    });

    promise.catch(function(err) {
      //console.log(err);
      res.sendStatus(http.INTERNAL_SERVER_ERROR);
    });
  });

  app.delete('/api/claim/:extClaimId', mw, function (req, res) {
    handleClaimStateChange(req.params.extClaimId,
      Claim.State.DISCARDED,
      claimUpdateCallbackFactory(res));
  });

  /**
   * Update UserValues document given the answers contained inside the form.
   */
  function updateUserValuesFromForm(form) {
    var promise = UserValues.findOne({
      userId: form.user
    });

    return promise.then(
      function (currentUserValues) {
        var newValues = _.merge(currentUserValues.values, form.responses);
        return UserValues.findOneAndUpdate(
          {userId: form.user},
          {values: newValues},
          {'new': true});
      });
  }

  // This is a mapping of user value keys to User object properties
  // The keys and values are interpreted as JSON path strings
  var USER_VALUES_TO_USER_PROPERTIES_MAPPING = {
    'contact.address.name': [['values.veteran_first_name', 'values.veteran_middle_initial', 'values.veteran_last_name'],
      ['values.claimant_first_name', 'values.claimant_middle_initial', 'values.claimant_last_name']],
    'contact.address.street1': [['values.veteran_home_address_line1']],
    'contact.address.street2': [['values.veteran_home_address_line2']],
    'contact.address.city': [['values.veteran_home_city']],
    'contact.address.province': [['values.veteran_home_state']],
    'contact.address.postal': [['values.veteran_home_zip_code']],
    'contact.address.country': [['values.veteran_home_country']],
    'contact.phoneNumber': [['values.contact_phone_number']],
    'firstname': [['values.veteran_first_name'], ['values.claimant_first_name']],
    'middlename': [['values.veteran_middle_name'], ['values.claimant_middle_name']],
    'lastname': [['values.veteran_last_name'], ['values.claimant_last_name']]
  };

  /**
   * Given a list of UserValues key names, resolve and concatenate the string values
   * and return it if they all exist, otherwise return undefined.
   */
  function resolveUserValuesOption(option, userValues) {
    var values = _.map(option, function(path) {
      return _.get(userValues, path);
    });

    if (_.reduce(values, function bothTrue(a, b) {return a && b;})) {
      var output = _.join(values, ' ');
      return output;
    } else {
      return undefined;
    }
  }

  /**
   * Update the user object with any information from the form that can be interpreted as user information.
   * For example address info, etc.
   */
  function updateUserFromForm(userValues) {
    var promise = User.findOne({
      _id: userValues.userId
    });

    promise = promise.then(function success(user) {
      _.map(USER_VALUES_TO_USER_PROPERTIES_MAPPING, function(userValuesOptions, userPath) {
        var val = _.get(user, userPath);
        if (!val) {
          var userValuesDerivedValues = _.filter(_.map(userValuesOptions, function(option) {
            return resolveUserValuesOption(option, userValues);
          }));

          if (!_.isEmpty(userValuesDerivedValues)) {
            console.log("Setting " + userPath + " to " + userValuesDerivedValues[0]);
            _.set(user, userPath, userValuesDerivedValues[0]);
          }
        } else {
          console.log("Refuse to overwrite existing value for " + userPath);
        }
      });

      return User.findByIdAndUpdate(
        user._id, user, {'new': true}
      );
    });

    return promise;
  }

  app.post('/api/save/:claim/:form', mw, function (req, res) {
    var resolvedClaim;
    var progress = ClaimService.calculateProgress(req.params.form, req.body);

    // Resolve the claim
    var promise = Claim.findOne({externalId: req.params.claim});

    // Render the new form values into the pdf
    promise = promise.then(
      function(claim) {
        resolvedClaim = claim;
        return documentRenderingService.renderDoc(req.params.form, req.body);
      }
    );

    // Save the pdf binary data and new form values into the Form document
    promise = promise.then(function(pdf) {
      return Form.findOneAndUpdate(
        {
          key: req.params.form,
          user: req.session.userId,
          claim: resolvedClaim._id
        },
        {
          key: req.params.form,
          responses: req.body,
          user: req.session.userId,
          claim: resolvedClaim._id,
          answered: progress.answered,
          answerable: progress.answerable,
          pdf: pdf
        },
        {
          upsert: true,
          'new': true
        });
    });

    // Update the UserValues document for the user with the new form responses
    promise = promise.then(function (form) {
      return updateUserValuesFromForm(form);
    });

    // Update the User document with form responses that might be critical user
    // info such as address or contact info.
    promise = promise.then(function (userValues) {
      return updateUserFromForm(userValues);
    });

    // Send 201 response (not sure if should be 200, but this endpoint creates multiple resources)
    promise.done(function success(user) {
      console.log("updated user:", user);
      res.sendStatus(http.CREATED);
    }, function failure(err) {
      console.log(err);
      res.sendStatus(http.INTERNAL_SERVER_ERROR);
    });
  });

  app.get('/api/claim/:claim/form/:form', mw, function (req, res) {
    Claim.findOne({externalId: req.params.claim}, function(error, claim) {
      if (error) {
        console.log(error);
        res.sendStatus(http.INTERNAL_SERVER_ERROR);
        return;
      }

      Form.findOne({
          key: req.params.form,
          user: req.session.userId,
          claim: claim._id
        },
        function (error, form) {
          res.status(http.OK).send({form: form});
        }
      );
    });
  });

  app.get('/api/claim/:claimId/form/:formName/pdf', mw, function (req, res) {
    var promise = Claim.findOne(
      {externalId: req.params.claimId}
    );

    promise = promise.then(function (claim) {
      return Form.findOne({
        key: req.params.formName,
        user: req.session.userId,
        claim: claim._id
      });
    });

    promise.done(function success(form) {
      res
        .status(http.OK)
        .set('Content-Type', 'application/pdf')
        .send(form.pdf);
    }, function failure(err) {
      console.log(err);
      res.sendStatus(http.INTERNAL_SERVER_ERROR);
    });
  });

  app.get('/api/claim/:claim/forms', mw, function (req, res) {
    Claim.findOne({externalId: req.params.claim}, function(error, claim) {
      if (error) {
        console.log(error);
        res.sendStatus(http.INTERNAL_SERVER_ERROR);
        return;
      }

      Form.find({
          user: req.session.userId,
          claim: claim._id
        },
        function (error, forms) {
          if (error) {
            console.log(error);
            res.sendStatus(http.INTERNAL_SERVER_ERROR);
            return;
          }
          res.status(http.OK).send(forms);
        }
      );
    });
  });
};
