'use strict';

const ApiBuilder = require('claudia-api-builder'),
  api = new ApiBuilder(),
  qs = require('qs'),
  xero = require('xero-node'),
  lib = require('claudiajs-dynamodb'),
  AWS = require('aws-sdk');

const config = {
  authorizeCallbackUrl: process.env.authorizeCallbackUrl,
  userAgent: process.env.UserAgent,
  consumerKey: process.env.ConsumerKey,
  consumerSecret: process.env.ConsumerSecret,
  s3BucketName: process.env.s3BucketName,
  runscopeBucketId: process.env.runscopeBucketId,
  privateKeyFileName: process.env.privateKeyName,
  cognitoAuthorizer: process.env.cognitoAuthorizer,
  cognitoUserPoolArn: process.env.cognitoUserPoolArn,
  cloudfrontUrl: process.env.cloudfrontUrl,
  dynamoDataTableName: process.env.dynamoDataTableName,
  dynamoWebhooksTableName: process.env.dynamoWebhooksTableName
};

// AWS Config
AWS.config.region = process.env.awsRegion;

function initXeroClient() {

  const s3 = new AWS.S3();

  return s3.getObject({ Bucket: config.s3BucketName, Key: config.privateKeyFileName }).promise()
    .then(function (data) {
      config.privateKey = data.Body.toString();
      return new xero.PartnerApplication(config);
    })
    .catch(function (err) {
      console.log("Error:", err);
    });
}

function saveData(data, table) {
  //returns a promise from the AWS API
  return lib.create(data, initDynamoClient(table));
}

function queryData(token, table) {
  //returns a promise from the AWS API
  return lib.query(token, initDynamoClient(table));
}

function scanData(filter, table) {
  var options = {
    filter: filter
  };

  //returns a promise from the AWS API
  return lib.scan(initDynamoClient(table), options);
}

function initDynamoClient(table) {
  let dynamoconfig = {
    region: process.env.awsRegion
  };
  var dynamo = new lib.dynamo(dynamoconfig);
  dynamo.tableName = table;
  return dynamo;
}

// Cognito Authorizer Setup
api.registerAuthorizer(config.cognitoAuthorizer, {
  providerARNs: [config.cognitoUserPoolArn]
});

// API GW Cors Setup
api.corsOrigin(config.cloudfrontUrl);
api.corsHeaders('Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Api-Version');
api.corsMaxAge(60); // in seconds 

//Redirect to xero and perform the authorisation
api.get('/RequestToken', (req, res) => {
  var xeroClient;
  return initXeroClient()
    .then(function (thisClient) {
      xeroClient = thisClient;
      return xeroClient.getRequestToken();
    })
    .then(function (data) {
      console.log("got request token", data.token);

      Object.assign(data, req.queryString);
      console.log("storing data in dynamo: ", data);
      return saveData(data, config.dynamoDataTableName).then(function (response) {
        if (!response.err) {
          console.log("no error, building url");
          let url = xeroClient.buildAuthorizeUrl(data.token);
          return url;
        } else {
          console.log("error occurred:", response.err);
          throw new Error("Error Occurred. Please check the logs.")
        }
      }).catch(function (err) {
        console.log(err);
        throw new Error("Error Occurred. Please check the logs.")
      });
    })
    .catch(function (err) {
      console.log(err);
      throw new Error("Error Occurred. Please check the logs.")
    });
}, { success: 302, error: 500 });


api.get('/RequestTokenRedirect', (req, res) => {

  console.log("Request: ", req.queryString)

  var data = {
    token: req.queryString.oauth_token
  };

  var xeroClient;

  return scanData(data, config.dynamoDataTableName)
    .then(function (response) {
      console.log("Database Response: ", response);
      var item = response.Items[0];
      var code = req.queryString.oauth_verifier;

      return initXeroClient()
        .then(function (thisClient) {
          xeroClient = thisClient;
          return xeroClient.setAccessToken(item.token, item.secret, code);
        })
        .then(function () {
          return xeroClient.core.organisations.getOrganisation();
        })
        .then(function (organisation) {
          item.orgid = organisation.OrganisationID;
          return saveData(item, config.dynamoDataTableName)
            .then(function (response) {
              return config.cloudfrontUrl + "/dashboard.html?orgname=" + organisation.Name;
            })
        })

        .catch(function (err) {
          console.log(err);
          throw new Error("Error Occurred. Please check the logs.")
        });
    })
    .catch(function (err) {
      console.log(err);
      throw new Error("Error Occurred. Please check the logs.")
    });
}, { success: 301, error: 500 });


api.post('/XeroWebhook', (req, res) => {
  console.log(req.body);
  var datalist = [];

  req.body.events.forEach(event => {
    datalist.push(saveData({
      orgid: event.tenantId,
      details: event
    }, config.dynamoWebhooksTableName));
  });

  return Promise.all(datalist)
    .then(() => {
      return "";
    })
    .catch(err => {
      console.error(err);
    });
}, { 
  success: {
    contentType: 'text/plain',
    code: 200
  }, 
  error: 500 
});


api.get('/XeroWebhook', (req, res) => {
  
  console.log("Request: ", req.queryString)
  
  var data = {
    username: req.queryString.username
  };

  return queryData(data, config.dynamoDataTableName)
    .then(function (response) {
      var item = response.Items[0];
      
      if(item !== undefined && item.orgid !== undefined) {
        return item.orgid;
      } else {
        throw new Error("Username not found");
      }
    })
    .then(orgid => {
      var data = {
        orgid: orgid
      };

      return scanData(data, config.dynamoWebhooksTableName);
    })
    .then(response => {
      return response.Items;
    })

}, { cognitoAuthorizer: config.cognitoAuthorizer, success: 200, error: 404 });

module.exports = api;