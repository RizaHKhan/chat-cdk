import { StackProps } from "aws-cdk-lib";
import { WebSocketApi } from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { StackExtender } from "../utils/StackExtender";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

export class ChatStack extends StackExtender {
  constructor(scope: Construct, props?: StackProps) {
    super(scope, "ChatStack", props);

    const lambdas = ["connect", "disconnect", "message"].map((name: string) => {
      return new Function(
        this,
        `Lambda${name.charAt(0).toUpperCase() + name.slice(1)}Function`,
        {
          runtime: Runtime.PYTHON_3_11,
          code: Code.fromAsset("lambda"),
          handler: `${name}.handler`,
        },
      );
    });

    // lambdas.forEach((lambda) => {
    //   lambda.addEnvironment("TABLE_NAME", "ChatConnections");
    // });

    // Creating the API Gateway WebSocket
    const socket = new WebSocketApi(this, "ChatSocket", {
      description: "Chat WebSocket",
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration("$connect", lambdas[0]),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration("$disconnect", lambdas[1]),
      },
    });

    socket.addRoute("message", {
      integration: new WebSocketLambdaIntegration("message", lambdas[2]),
    });

    new StringParameter(this, "WebSocketApiUrlParam", {
      parameterName: "/chat/websocket-url",
      stringValue: socket.apiEndpoint,
      description: "WebSocket API URL for the Chat Application",
    });
  }
}
