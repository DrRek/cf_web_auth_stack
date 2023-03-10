import { CfnParameter, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CfnDistribution } from 'aws-cdk-lib/aws-cloudfront';

export class CdkAuthWebappStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
     * INIT CONFIGURATION
     * setting up required paramters and checking their value
     */
    const domainPrefixParam = process.env.DOMAIN_NAME
    const googleClientIdParam = process.env.GOOGLE_CLIENT_ID
    const googleClientSecretParam = process.env.GOOGLE_CLIENT_SECRET
    if(!domainPrefixParam || !googleClientIdParam || !googleClientSecretParam){
      throw new Error('Make sure you initialized DOMAIN_NAME, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment')
    }



    /**
     * BUCKET FOR FRONTEND CREATION
     */

    // This will create the bucket that stores the frontend code
    const frontendbucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${domainPrefixParam}-frontend-bucket`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
    }); 



    /**
     * CLOUDFRONT DISTRIBUTION
     * this is sadly used only to easily give https access to the website as it is required by cognit
     */

    // This is used to create the actual cf distribution
    const cfdistribution = new cloudfront.CloudFrontWebDistribution(this, 'CFDistribution', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: frontendbucket,
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

    /**
     * Following here a workaround to work with OAC instead of OAI which are deprecated
     * The following code was adapted from a workaround of an open issue on GitHub.
     * More details: https://github.com/aws/aws-cdk/issues/21771
     */
    const cfdistributionoac = new cloudfront.CfnOriginAccessControl(this, 'CFOriginAccessControl', {
      originAccessControlConfig: {
        description: 'Origin Access Control for S3 bucket',
        name: 'CFOriginAccessControl',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      }
    })
    const cfnd = cfdistribution.node.defaultChild as CfnDistribution
    cfnd.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', cfdistributionoac.getAtt('Id'))
    const distribution_arn = cdk.Arn.format({
      service: 'cloudfront',
      resource: 'distribution',
      region: '',
      resourceName: cfdistribution.distributionId,
      arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
    }, this)
    frontendbucket.addToResourcePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [ 's3:GetObject' ],
          principals: [ new iam.ServicePrincipal('cloudfront.amazonaws.com') ],
          resources: [ frontendbucket.arnForObjects('*') ],
          conditions: {
              'ArnEquals': {
                  'AWS:SourceArn': distribution_arn,
              },
          },
        })
      )

    // This is used by cognito to allow list URL that the Hosted UI can redirect to
    const CLOUDFRONT_PUBLIC_URL = `https://${cfdistribution.distributionDomainName}/`



    /**
     * COGNITO USER POOL CREATION
     */

    // The userpool will register all the users that ever logged in
    const userpool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'web-app-user-pool',
      selfSignUpEnabled: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // This integrates the existing user pool with Google
    const identityprovidergoogle = new cognito.UserPoolIdentityProviderGoogle(this, 'IdentityProviderGoogle', {
      clientId: googleClientIdParam,
      clientSecret: googleClientSecretParam,
      userPool: userpool,
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL
      },
      scopes: [ 'email' ]
    })

    // This will create the Hosted UI URL
    userpool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: domainPrefixParam
      }
    })

    // This will create the client associated with the user pool and the identity provider
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

    client.node.addDependency(identityprovidergoogle)



    /**
     * BACKEND LAMBDA
     * We will set it up in such a way that only logged users can access it
     */

    // This defines the lambda itself
    const securedlambda = new lambda.Function(this, 'SecuredLambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'secured.handler'
    });
    
    // This create an integration to import the lambda in the apigw
    const lambdaapigwintegration = new apigw.LambdaIntegration(securedlambda)



    /**
     * BACKEND APIGateway
     * We will set it up in such a way that only logged users can access it
     */

    // This defines the apigw
    const backendapigw = new apigw.RestApi(this, 'BackendApigw', {
      restApiName: domainPrefixParam,
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'Authorization',
        ],
        allowMethods: ['OPTIONS', 'GET'],
        allowCredentials: true,
        allowOrigins: ['*']
      }
    })

    // This is the authorized to apply to the APIgw resource that check auth with the Cognito User Pool
    const backendapiauthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'BackendAPIAuthorizer', {
      cognitoUserPools: [userpool]
    })

    // This is the lambda resource that define the API
    backendapigw.root.addMethod('GET', lambdaapigwintegration, {
      authorizer: backendapiauthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO
    })



    /**
     * FRONTEND DEPLOYMENT
     * This is used to deploy the frontend code. The constants.js file is created upon deployment, it contains:
     * domainPrefix - used to define the Cognito Hosted UI url
     * apigw_id - used to define the APIGateway url
     * region - used to define both the Cognito Hosted UI url and the APIGateway url
     * cognito_client_id - supplied to the Hosted UI get request to perform authentication
     */
    new s3deployment.BucketDeployment(this, 'DeployFrontEnd', {
      sources: [
        s3deployment.Source.asset('./frontend'),
        s3deployment.Source.data('constants.js', `
          const constants = {
            domainPrefix:'${domainPrefixParam}', 
            region:'${this.region}', 
            cognito_client_id:'${client.userPoolClientId}', 
            apigw_id:'${backendapigw.restApiId}'
          }`
        )
      ],
      destinationBucket: frontendbucket,
      distribution: cfdistribution
    })

    /**
     * END CONFIGURATION
     * returning the url to reach the frontend
     */
    new cdk.CfnOutput(this, 'YourPublicCloudFrontURL', {
      value: CLOUDFRONT_PUBLIC_URL,
      description: 'Navigate to the URL to access your deployed application'
    })
  }
}
