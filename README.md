# Xero Webhooks Sample App

This is a sample application for using Xero's Contact Webhooks (BETA).

The functionality is as follows:

- Create Account / Sign in with Facebook
- Connect your Xero Account
- View a list of Contact Events (refreshes every 45 seconds)

## Before Proceeding - Xero Partner Application Required

You will need a Xero Partner Application to use this sample app.  In order to get a Partner Application you must first create a Public application and apply for it to be upgraded.

Please browse to `https://developer.xero.com/partner` and fill out the form if you're interested in having a partner application.

Once you've got your partner tokens, feel free to continue this process.

## Architecture

This application is built on the following AWS technologies:

- AWS Cloudfront (SSL)
- AWS S3 (Static Website Hosting/Xero API Private Key Storage)
- AWS Cognito (User Auth)
- AWS API Gateway
- AWS Lambda
- AWS DynamoDB

## Getting Started 

You'll need access to the following:

- AWS Account (https://aws.amazon.com/free/)
- Xero Account (https://www.xero.com)
- Xero Developer Application (https://developer.xero.com)
- Facebook Account (https://developers.facebook.com)

*Note: I configured all of this in the us-east-1 region. I am not 100% confident this will work exactly the same in other regions.* 

### Create an S3 Bucket for your API Private Key

The Xero API is authenticated using RSA-SHA1 signatures. This is signed using a privatekey file that is required to be generated when you upgrade your app from Public to Partner.

This private key file needs to be accessible to the Lambda functions so the API calls can be made.

Follow these steps to create a bucket for your private key file:

1. Sign in to AWS
2. Create a new S3 bucket
3. Upload your privatekey.pem file into this S3 bucket
4. Make sure all world permissions are disabled so no one can access the bucket unless authenticated.

Your privatekey file is now available for your lambda functions to use.

### Create an S3 Bucket for your website

1. Sign in to AWS.
2. Create a new S3 bucket for your front end code.
3. Enable static website hosting on the bucket and note the URL.
4. Apply the following Bucket Policy

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AddPerm",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::<bucket name>/*"
        }
    ]
}
```
**Make sure you substitute <bucket name> for your bucket name...**

### Create a Cloudfront Distribution for SSL Support

To use AWS Cognito for Authorization, your website needs to use SSL.  With S3 hosted sites, the way to get an SSL certificate for free is to use Cloudfront.

Follow these steps to secure your S3 website with CloudFront.

1. Sign in to AWS
2. Browse to CloudFront
3. Click on 'Create Distribution' and select 'Web'
4. In the 'Origin Domain Name' you'll need to enter your S3 Bucket Website address.

**IMPORTANT: Don't just select it from the dropdown. You need to enter the static website url, not the bucket url**.

e.g. the dropdown will say something like:

`xero-webhooks-sample-app.s3.amazonaws.com`

but what you actually need to enter in this field is:

`xero-webhooks-sample-app.s3-website-us-east-1.amazonaws.com`

The CloudFront distribution will not work unless you enter this field correctly.

5. Viewer Protocol Policy should be set to 'Redirect HTTP to HTTPS'
6. Allowed HTTP Methods should be 'GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE'
7. Change 'Object Caching' to Customize and set the Default TTL to '60'
8. Leave all others as defaults and click 'Create Distribuition'.

This will now start creating and distributing your website to edge locations around the world.  Don't worry that we haven't deployed a site there yet.  As the Cache Timeout is only 60s it won't take long to update when we actually deploy something.

Take note of the cloudfront distribution URL as this is your URL to your website.  It will be something like:

`d1kyjbvgsd1y6g.cloudfront.net`

### Sign in with Facebook (Optional)

If you want your users to be able to sign in with Facebook, you'll need to create an app on the Facebook developer platform.

Feel free to skip this step if it's not relevant.

1. Sign in to https://developers.facebook.com
2. Create a new App
3. Put any dummy data in to get it created, we just need the App ID and App Secret

### Create the Cognito User Pool

1. Sign in to AWS
2. Browse to Cognito and select User Pools
3. Create a new User Pool
4. Enter the Pool Name and select 'Review Defaults'
5. Select 'Alias Attributes' and check the following standard attributes:
- email
- family name
- given name
6. Click 'Next' to accept all remaining defaults and create the user pool.

### Create the Cognito Facebook Identity Provider (Optional)

1. Open the User Pool and select 'Identity Providers'
2. Select Facebook
3. Copy / Paste the Facebook App ID and Secret here
4. Enter the Authorized Scope: `public_profile,email`
5. Click 'Update Facebook'

### Create the Cognito App Client

1. Select App Client Settings and click Add App Client
2. Give your app client a name and **uncheck** generate secret.
3. Enable the appropriate Identity Providers (Facebook/Cognito User Pool)
4. Sign In URL: **[CLOUDFRONT URL]**/dashboard.html

e.g. `https://d1kyjbvgsd1y6g.cloudfront.net/dashboard.html`

5. Sign Out URL: **[CLOUDFRONT URL]**/index.html

e.g. `https://d1kyjbvgsd1y6g.cloudfront.net/index.html`

6. Check 'Implicit Grant' under OAuth 2.0
7. Select the following OAuth Scopes
- phone
- email
- openid
- profile

8. Click 'Choose Domain Name'.
9. Enter a domain name for your app and click 'Check Availability'
10. Click 'Save' to save the app client.


### Finish Facebook Configuration (Optional)

1. Browse to your Facebook app
2. Enter the Cognito Domain name into your Facebook App Domain and Website URL fields
3. Click Save
4. Publish the Facebook app to allow any user to sign in with it.


### Create the DynamoDB Tables

To use this application we need to create two dyanmodb tables.  

The first table will store the logged in user, their Xero API Tokens and their associated Xero Org.

The second table will store the webhooks fired from Xero and the association to the Xero Org.

Create the app-users table in DynamoDB:

1. Browse to DynamoDB
2. Click Create Table
3. Name the Table `xero-webhooks-sample-app-users`
4. Set the key field to be `username`
5. Accept the default read/write units and click 'Save'

Create the webhooks table in DynamoDB:

1. Browse to DynamoDB
2. Click Create Table
3. Name the Table `xero-webhook-receiver`
4. Set the key field to be `id`
5. Accept the default read/write units and click 'Save'


### Create the Role for Deployment

In order to deploy the backend of this application to API Gateway/Lambda, and the Frontend to S3 you need to create a user in IAM with appropriate permissions.

1. Browse to IAM
2. Select Users and click 'Add User'
3. Name the user `XeroWebhooksDeployer`
4. Select the 'Programmatic Access' checkbox and click 'Permissions'
5. Select 'Attach existing policies directly' and choose the following policies:
- `AdministratorAccess`
6. Click 'Review'
7. Click 'Create User'
8. Take note of the Access Key ID, and Secret Access Key

**IMPORTANT: These keys are only shown to you here. If you don't copy them you can't ever get them back**.

9. Create a folder in your home directory called `.aws`
10. Create a file in this folder called `credentials` and populate it as follows:

```
[XeroWebhooksDeployer]
aws_access_key_id = <key from aws>
aws_secret_access_key = <secret key from aws>
```

Your credentials file is now ready for deployments.

### Deploy the Back End

1. Clone this repo (if you haven't already)
2. Browse to the `/backend` directory
3. Duplicate the example.env.json and call it `env.json` and fill out the properties.

|Field ( Mandatory)|Description|Example|
|-----|-----------|-------|
|ConsumerKey|This is the consumer key for your Xero App from the Xero Developer Portal.|`CICDNCDSODSCIOCDS99D90`|
|ConsumerSecret|This is the consumer secret for your Xero App from the Xero Developer Portal.|`FDONDFSIOFDSNODFSSINO9`|
|UserAgent|Enter an appropriate string to name your app.|`My Awesome App`|
|authorizeCallbackUrl|This is the callback URL.|`https://7wthc1c794.execute-api.us-east-1.amazonaws.com/latest/RequestTokenRedirect`|
|s3BucketName|The name of the S3 bucket that your Private Key lives in.|`XeroWebhooks`|
|privateKeyName|The file name of your private key file|`privatekey.pem`|
|cognitoAuthorizer|The name of your cognito authorizer (can be anything).|`xero-webhook-sample-app-users`|
|cognitoUserPoolArn|The ARN of your cognito user pool.|`arn:aws:cognito-idp:us-east-1:1231221123:userpool/us-east-fFEF903c`|
|cloudfrontUrl|The Cloudfront URL for your distribution.|`https://d1kyjbvgsd1y6g.cloudfront.net`|
|dynamoDataTableName|The DynamoDB table name for your user storage.|`xero-sample-app-users`|
|dynamoWebhooksTableName|The DynamoDB table name for your webhooks storage.|`xero-webhook-receiver`|
|awsRegion|The Region you are working in.|`us-east-1`|

*Note: you won't have the `authorizeCallbackUrl` yet.  This will be provided after the first deploy.  You can then update this file, then redeploy.*

4. Install claudia.js by executing the following command:

`npm install claudia -g`

5. Use Claudia to deploy your application using the following command:

```
claudia create 
--region us-east-1 
--api-module index 
--profile XeroWebhooksDeployer 
--set-env-from-json env.json
```

This will create the following entites in your AWS account:
- IAM Role for Lambda Functions
- An API Gateway Service
- A new Lambda function

This will then provide you with a new URL that looks as follows:

`https://7wthc1c794.execute-api.us-east-1.amazonaws.com/latest/`

6. Copy this value into the env.json file in the `authoriseCallbackUrl` property as follows:

`https://7wthc1c794.execute-api.us-east-1.amazonaws.com/latest/RequestTokenRedirect`

7. Redeploy using the following command:

```
claudia update 
--profile XeroWebhooksDeployer 
--set-env-from-json env.json
```

The backend service is now deployed.

### Modify the Lambda Role

Claudia JS has created you a Lambda role, but it doesn't have the right permissions.

1. Browse to IAM
2. Click 'Roles'
3. Select the role `backend-executor`
4. Click 'Attach Policy' and attache the following:
- AmazonDynamoDBFullAccess
- AmazonS3ReadOnlyAccess

Now your lambda functions can access S3 to get the PrivateKey for API calls, and access DynamoDB to read/write data.

### Deploy the Front End

This process will modify your webiste to use your backend services, and also sync it up to S3 using a tool called `s3cmd`.

*Note: you can install `s3cmd` with homebrew using `brew install s3cmd`.*

1. Browse to the `/frontend` directory.
2. Edit the file `js/dashboard.js` and set the following constants:

|Constant Name|Description|Example|
|-----|-----------|-------|
|`COGNITO_APP_ID`|This is the App Client ID from Cognito|`fd0ihdfsah0dfsh90dfs`|
|`COGNITO_AUTH_URL`|This is the Cognito Auth Domain.|`https://xero-webhooks-sample-app.auth.us-east-1.amazoncognito.com`|
|`CLOUDFRONT_URL`|This is your CloudFront URL.|`https://d1kyjbvgsd1y6g.cloudfront.net`|
|`API_GW_URL`|This is your API Gateway URL from ClaudiaJS|`https://7wthc1c794.execute-api.us-east-1.amazonaws.com/latest`|

3. Save the file, then copy these constants across to `js/index.js`
4. Save index.js
5. Use the following command to sync the files up to S3:

```
s3cmd sync * s3://<BUCKET_NAME> 
--access_key=<AWS ACCESS KEY> 
--secret_key=<AWS SECRET KEY> 
--delete-removed
```

This will sync all the files to your S3 bucket and make them available as a website. 


### Log in to the service

Now you should be able to browse to your Cloudfront URL and see the whole process in action.

1. Browse to your CloudFront URL. 

e.g. `https://d1kyjbvgsd1y6g.cloudfront.net`

2. Click 'Get Started'
3. Log in with Facebook or Cognito Auth
4. Once logged in, click 'Connect to Xero'
5. Sign into your Xero Account
6. Authorize the App against an Org and click 'Allow Access'
7. You'll be redirected to the dashboard and a URL will be provided.  This needs to go into the webhooks console.

### Create the Webhook in Xero

This is the final step that actually links Xero to your application.

1. Browse to the Webhooks console: `https://developer.xero.com/myapps/webhooks`
2. Sign in to the console
3. Select your app from the list
4. Pick 'Contacts' as the webhook
5. Paste the webhook URL from above and click 'Save'

Now your Webhook has been set up, go and modify a contact in Xero and you'll see it pop up as a webhook event in your web app.

## Feedback / Questions

This application is a sample only and is not intended for production usage.  Please use at your own risk.

Please raise an issue on the repository if you would like further work done, or feel free to fork/PR if you want to add.