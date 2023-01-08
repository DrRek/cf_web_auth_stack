# CDK TypeScript project to deploy a small serverless with google authentication

![Preview Image](https://raw.githubusercontent.com/DrRek/cf_web_auth_stack/main/docs/resources/simplewebauth.png)

## Description
This stack contains all the required resources to create a serverless app integrated with google authentication.
A sample frontend hosted on bucket can be easily replaced with any other backend, stored in any other place, using any stack (React, Angular, etc.).
The frontend receives the oauth tokens from Cognito. With these, adding the `Authentication: Bearer ${id_token}` header to any API Gateway endpoint, it is possible to prevent any authenticated app from executing backend commands. If using lambda's as backend, the identity of the logged user [can be accessed in the event object](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-enable-cognito-user-pool.html).

## To launch this project in your AWS account
`git clone https://github.com/DrRek/cf_web_auth_stack`
`cd cf_web_auth_stack`
set up a google project as explained below
`export DOMAIN_NAME=<any prefix you wish>` this will be used to create resources
`export GOOGLE_CLIENT_ID=<client it taken from google cloud console>`
`export GOOGLE_CLIENT_SECRET=<client secret taken from google cloud console>`
`cdk deploy` or `cdk watch`

## Setup a google project
TODO
