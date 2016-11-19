'use strict';
var app = angular.module('vetafiApp');
app.factory('net', ['xhrEnv', '$http', function(xhrEnv, $http) {

  var httpGet = function (url, data) {
    return $http({
      url: "/api" + url,
      method: "GET",
      headers: { 'Content-Type': 'application/json' }
    });
  };

  var httpPost = function(url, data) {
    return $http({
      url: "/api" + url,
      method: "POST",
      data: data || {},
      headers: { 'Content-Type': 'application/json' }
    });
  };

  var httpDelete = function(url) {
    return $http.delete(url);
  };

  return {
    // Auth
    login: function (email, password) {
      var data = {
        email: email,
        password: password
      };
      return httpPost("/auth/login", data);
    },
    logout: function() {
      return httpGet("/auth/logout");
    },
    signup: function(userData) {
      return httpPost("/auth/signup", userData);
    },
    touchSession: function() {
      return httpGet("/session/touch");
    },
    getAuthIdMeUrl: function() {
      return '/auth/idme';
    },
    changePassword: function(oldPwd, newPwd) {
      var data = {
        old: oldPwd,
        new: newPwd
      };
      return httpPost("/auth/password", data);
    },

    // User
    getUserInfo: function() {
      return httpGet("/user");
    },
    editUserInfo: function(data) {
      return httpPost("/user", data);
    },
    deleteUserAccount: function() {
      return httpDelete("/user");
    },

    // Claims
    getClaimsForUser: function() {
      return httpGet("/claims");
    },
    startClaim: function(data) {
      return httpPost("/claims/create", data);
    },
    submitClaim: function(extClaimId, data) {
      return httpPost("/claim/" + extClaimId + "/submit", data);
    },
    discardClaim: function(extClaimId) {
      return httpDelete("/claim/" + extClaimId);
    },
    getClaim: function(extClaimId) {
      return httpGet("/claim/" + extClaimId);
    },
    getFormsForClaim: function(extClaimId) {
      return httpGet("/claim/" + extClaimId + "/forms");
    },
    saveForm: function(claimId, formId, data) {
      return httpPost('/save/' + claimId + '/' + formId, data);
    },
    downloadForm: function(claimId, formId) {
      return httpGet("/claim/" + claimId + "/form/" + formId + "/pdf");
    }
  };
}]);
