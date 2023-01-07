import { CloudFormationCollection } from './../node_modules/aws-sdk/clients/devopsguru.d';
import { DomainPrefix } from './../node_modules/aws-sdk/clients/amplify.d';
import { OriginAccessControl, OriginAccessControlConfig } from './../node_modules/aws-sdk/clients/cloudfront.d';
import { OAuthScopesElement } from './../node_modules/aws-sdk/clients/amplifybackend.d';
import { OAuthScope } from './../node_modules/aws-sdk/clients/appflow.d';
import { scope } from './../node_modules/aws-sdk/clients/ec2.d';
import { ClientSecret, CognitoUserPool } from './../node_modules/aws-sdk/clients/sagemaker.d';
import { CfnParameter, Duration, lambda_layer_awscli, Stack, StackProps } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';



//TODO: make the script region agnostic
//TODO: fare in modo che siano in modo 
//TODO: make sure that on destoy everything is completely obliterated
//TODO: pulire tutti gli import
//TODO: aggiungere tutti i commenti
//TODO: migliorare il frontends
//TODO: delete the costants file
//TODO: destroy cognito

export class CdkAuthWebappStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domainPrefixParam = new CfnParameter(this, 'DomainPrefix', {
      type: 'String',
      description: 'You have to set it in google cloud as well', //(TODO: add link to explain properly)
      default: process.env.DOMAIN_NAME || ''
    })

    const googleClientIdParam = new CfnParameter(this, 'GoogleClientId', {
      type: 'String',
      description: 'From google project',
      noEcho: true,
      default: process.env.GOOGLE_CLIENT_ID || ''
    })

    const googleClientSecretParam = new CfnParameter(this, 'GoogleClientSecret', {
      type: 'String',
      description: 'From google project',
      noEcho: true,
      default: process.env.GOOGLE_CLIENT_SECRET || ''
    })

    if(!domainPrefixParam.value || !googleClientIdParam.value || !googleClientSecretParam.value){
      throw new Error('Make sure you initialized DomainPrefix, GoogleClientId and GoogleClientSecret in the stack parameters')
    }

    const s3frontend = new s3.Bucket(this, 'Bucket', {
      bucketName: domainPrefixParam.valueAsString+'-frontend-bucket',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
    }); 

    //TODO: fare in modo che questa origin access identity non sia legacy quando deployo
    const cfdistributionoriginaccessidentity = new cloudfront.OriginAccessIdentity(this, 'CFOriginAccessIdentity', {
      comment: "Used to give bucket read to cloudfront"
    })

    const cfdistribution = new cloudfront.CloudFrontWebDistribution(this, 'CFDistributionFrontend', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: s3frontend,
            originAccessIdentity: cfdistributionoriginaccessidentity
          },
          behaviors: [{ 
            isDefaultBehavior: true,
            allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
            forwardedValues: {
              queryString: true,
              cookies: { forward: 'all' }
            },
            minTtl: cdk.Duration.seconds(0),
            defaultTtl: cdk.Duration.seconds(3600),
            maxTtl: cdk.Duration.seconds(86400)
          }]
        }
      ]
    })

    s3frontend.grantRead(cfdistributionoriginaccessidentity)

    const cfdistributionpolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`"arn:aws:cloudfront::${this.account}:distribution/${cfdistribution.distributionId}"`]
    });

    const userpool = new cognito.UserPool(this, 'WebAppUserPool', {
      userPoolName: 'web-app-user-pool',
      selfSignUpEnabled: false
    })

    const userpoolidentityprovidergoogle = new cognito.UserPoolIdentityProviderGoogle(this, 'WebAppUserPoolIdentityGoogle', {
      clientId: googleClientIdParam.valueAsString,
      clientSecret: googleClientSecretParam.valueAsString,
      userPool: userpool,
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL
      },
      scopes: [ 'email' ]
    })

    // this is used to make the hostedui reachable
    userpool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: domainPrefixParam.valueAsString
      }
    })

    const CLOUDFRONT_PUBLIC_URL = `https://${cfdistribution.distributionDomainName}/`

    const client = userpool.addClient('Client', {
      oAuth: {
        flows: {
          authorizationCodeGrant: true
        },
        callbackUrls: [
          CLOUDFRONT_PUBLIC_URL
        ],
        logoutUrls: [
          CLOUDFRONT_PUBLIC_URL
        ],
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PHONE
        ]
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE
      ]
    })

    client.node.addDependency(userpoolidentityprovidergoogle)

    // defines an AWS Lambda resource
    const securedlambda = new lambda.Function(this, 'AuhtorizedRequestsHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'secured.handler'
    });

    const lambdaapiintegration = new apigw.LambdaIntegration(securedlambda)

    const backendapigw = new apigw.RestApi(this, 'AuthorizedRequestAPI', {
      restApiName: domainPrefixParam.valueAsString,
      defaultCorsPreflightOptions: {
        "allowOrigins": apigw.Cors.ALL_ORIGINS,
        "allowMethods": apigw.Cors.ALL_METHODS,
      }
    })

    const backendapiauthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'BackendAPIAuthorizer', {
      cognitoUserPools: [userpool]
    })

    const authorizedresource = backendapigw.root.addMethod('GET', lambdaapiintegration, {
      authorizer: backendapiauthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO
    })

    const s3deploymentfrontend = new s3deployment.BucketDeployment(this, 'DeployFrontEnd', {
      sources: [
        s3deployment.Source.asset('./frontend'),
        s3deployment.Source.data('constants.js', `const constants = {domainPrefix:'${domainPrefixParam.valueAsString}', region:'${this.region}', cognito_client_id:'${client.userPoolClientId}', apigw_id:'${backendapigw.restApiId}'}`)
      ],
      destinationBucket: s3frontend,
      distribution: cfdistribution
    })

    new cdk.CfnOutput(this, 'YourPublicCloudFrontURL', {
      value: CLOUDFRONT_PUBLIC_URL,
      description: 'Navigate to the URL to access your deployed application'
    })
  }
}
