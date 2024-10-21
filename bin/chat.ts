#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatStack } from '../lib/chat-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App({
  context: {
    domainName: 'modernartisans.xyz'
  },
});

new ChatStack(app);
new FrontendStack(app);
