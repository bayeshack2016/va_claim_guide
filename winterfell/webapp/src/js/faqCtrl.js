var app = angular.module('vetafiApp');
app.controller('faqCtrl', ['$scope', function($scope) {
  $scope.sections = [
    {
      title: 'First Resource',
      content: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.",
      tags: ['health']
    },
    {
      title: 'Second Resource',
      content: "It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged.",
      tags: ['firefighter']
    },
    {
      title: 'Third Resource',
      content: "Contrary to popular belief, Lorem Ipsum is not simply random text. It has roots in a piece of classical Latin literature from 45 BC, making it over 2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney College in Virginia, looked up one of the more obscure Latin words.",
      tags: ['benefits']
    }
  ];

  $scope.searchText = '';
  $scope.onSearchChange = function() {
  };

}]);
