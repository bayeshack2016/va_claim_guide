'use strict';
var app = angular.module('vetafiApp');
app.factory('xhrEnv', function() {
  return {
    isDev: false,
    baseServerUrl: 'https://www.vetafi.org',

    idMeClientId: '71ffbd3f04241a56e63fa6a960fbb15e',
  };
});