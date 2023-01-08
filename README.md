# CDK TypeScript project to deploy a small serverless with google authentication

## Description
This stack contains all the required resources to create a serverless app integrated with google authentication.
A sample frontend hosted on bucket can be easily replaced with any other backend, stored in any other place, using any stack (React, Angular, etc.).
The frontend receives the oauth tokens from Cognito. With these, adding the `Authentication: Bearer ${id_token}` header to any API Gateway endpoint, it is possible to prevent any authenticated app from executing backend commands. If using lambda's as backend, the identity of the logged user [can be accessed in the event object](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-enable-cognito-user-pool.html).

![Preview Image](https://raw.githubusercontent.com/DrRek/cf_web_auth_stack/main/docs/resources/simplewebauth.png)

## To launch this project in your AWS account
* Make sure your aws cli is [installed and configured](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
* Make sure your cdk v2 is [installed](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) 
* Clone the repository 

`git clone https://github.com/DrRek/cf_web_auth_stack`
* Open the project folder

`cd cf_web_auth_stack`
* Set up a google project as explained below
* Export the DOMAIN_NAME environment variable used as prefix while creating the resources in your accocunt

`export DOMAIN_NAME=<any prefix you wish>`
* Export the environment variable with google project configuration

```
export GOOGLE_CLIENT_ID=<client it taken from google cloud console>
export GOOGLE_CLIENT_SECRET=<client secret taken from google cloud console>
```
* Make any required edit to the stack
* Deploy the application

`cdk deploy` or `cdk watch`

* Check the output of the command for a link similar to the following, use the printed link in your browser to access the application.

`CdkAuthWebappStack.YourPublicCloudFrontURL = https://d3td55vopauj3g.cloudfront.net/`

## Setup a google project
To setup google authentication you will need a google project. To do so, follow these step.
* Follow [these steps](https://cloud.google.com/appengine/docs/standard/nodejs/building-app/creating-project) to create a new project
* Navigate to the [google cloud console](https://console.cloud.google.com)
* Make sure you've selected your newly created project on the top left
* In the search bar write and select "OAuth consent screen"
* [Configure the OAuth consent screen](https://developers.google.com/workspace/guides/configure-oauth-consent), make sure add "amazoncognito.com" as one of the authorized domains
* Select "Creadentials" in the left bar
* Click on "Create credentials"
* Select "ID client OAuth"
* Select "Web application" as application type
* Make sure that "Authorized JavaScript origins" contains `https://${DOMAIN_NAME}.auth.${REGION}.amazoncognito.com` where DOMAIN_NAME is the environment variable setted in the previous section and REGION is the aws region where you will deploy the resource (ex. https://webapp-with-webauth.auth.eu-central-1.amazoncognito.com)
* Make sure that "Authorized redirect URI" contains `https://${DOMAIN_NAME}.auth.${REGION}.amazoncognito.com/oauth2/idpresponse` where DOMAIN_NAME is the environment variable setted in the previous section and REGION is the aws region where you will deploy the resource (ex. https://webapp-with-webauth.auth.eu-central-1.amazoncognito.com)
* Click on create
* Download or memorize somewhere the client id and client secret, these will need to be added in the environment variables as respectively GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as metioned in the previous section.


## Future improvements
* Improve modularity and deploy as npm package
* Integrate it in pipelines
* Work with multiple environments

