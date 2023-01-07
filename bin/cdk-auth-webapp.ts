#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkAuthWebappStack } from '../lib/cdk-auth-webapp-stack';

const app = new cdk.App();
new CdkAuthWebappStack(app, 'CdkAuthWebappStack');
