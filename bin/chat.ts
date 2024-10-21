#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatStack } from '../lib/chat-stack';

const app = new cdk.App({
  context: {
    domainName: 'modernartisans.xyz'
  },
});

new ChatStack(app);
