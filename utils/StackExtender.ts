import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

export class StackExtender extends Stack {
  public domainName: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.domainName = this.node.tryGetContext('domainName');
  } 
}
