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

## Setup a google project
TODO

## Future improvements
* Improve modularity and deploy as npm package

