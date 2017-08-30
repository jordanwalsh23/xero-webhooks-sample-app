'use strict';

const COGNITO_APP_ID = '5n1bo1i9pkgngofpkeskcv9et3';
const COGNITO_AUTH_URL = 'https://xero-webhooks-sample-app.auth.us-east-1.amazoncognito.com';
const CLOUDFRONT_URL = 'https://d1kyjbvgsd1y6g.cloudfront.net';
const API_GW_URL = 'https://7wthc1c794.execute-api.us-east-1.amazonaws.com/latest';

$(document).ready(function(){

  var token = getToken();

  if(!token) {
    location.href = "index.html";
  }
  
  // Save the new token into session storage.
  sessionStorage.setItem('aws_id_token',token);

  // Decode the JWT
  var decoded;
  
  try {
    decoded = jwt_decode(token);  
  } catch (ex) {
    location.href = "index.html";
  }
  
  // Display some values in the screen
  $("#given_name").text(decoded.given_name);

  var orgname = getOrgName();

  if(orgname !== null) {

    sessionStorage.setItem("xero_org_name", orgname);
    
    $("#xero-connect").hide();
    $("#xero-orgname").text(decodeURIComponent(orgname));
    $("#xero-webhook-url").text(API_GW_URL + "/XeroWebhook");
    $("#xero-org").show();

    setInterval(function(){
      refreshWebhooks(token, decoded['cognito:username']);
    }, 45000);

    refreshWebhooks(token, decoded['cognito:username']);

  } else {
    $("#xero-org").hide();
    $("#xero-connect").show();
    $("#xero-connect a").click(function() {
      location.href = API_GW_URL + "/RequestToken?username=" + decoded['cognito:username'];
    });
  }
});

function getToken() {
  var token = sessionStorage.getItem('aws_id_token');

  if(token) return token;

  // Check the URL for the # parameter
  var search = window.location.hash.substr(1);

  if(search !== "") {
    // convert the key/value pairs into a JSON object
    var urlparams = '{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}';
    
    try {
      var result = JSON.parse(urlparams);
      
      if(result) {
        return result.id_token;
      } else {
        throw new Error("JSON couldn't be parsed");
      }
    } catch (ex) {
      return "";
    }
  }
}

function getOrgName() {
  return getUrlVars()['orgname'] || sessionStorage.getItem("xero_org_name");
}

function logout() {
  sessionStorage.clear();
  location.href = COGNITO_AUTH_URL + "/logout?client_id=" + COGNITO_APP_ID + "&logout_uri=" + CLOUDFRONT_URL + "/index.html";
}

function refreshWebhooks(token, username) {
  $.ajax({
    type: "GET",
    url: API_GW_URL + "/XeroWebhook?username=" + username,
    dataType: 'json',
    async: true,
    beforeSend: function (xhr){ 
      $('#webhook-data').empty();
      $('#webhook-data').text('Loading...');
      xhr.setRequestHeader('Authorization', token); 
    },
    success: function (data){
      $('#webhook-data').empty();

      // Create the Table Element
      var table = document.createElement('table');
      $(table).addClass('table table-bordered');

      var headers = ['Event Category', 'Event Type', 'Resource ID', 'Event Date (UTC)'];
      var tr = document.createElement('tr');
      
      // Add the Table Headers
      $.each(headers, function() {
        $(tr).append("<th>" + this + "</th>");
      });

      $(table).append(tr);

      // Add the Table Data
      $.each(data, function() {
        tr = document.createElement('tr');
        $(tr).append("<td>" + this.details.eventCategory + "</td>");
        $(tr).append("<td>" + this.details.eventType + "</td>");
        $(tr).append("<td>" + this.details.resourceId + "</td>");
        $(tr).append("<td>" + this.details.eventDateUtc + "</td>");
        $(table).append(tr);
      });

      // Append the Table Element to the div
      $('#webhook-data').append(table);
    }
  });
}

function getUrlVars() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}