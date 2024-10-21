import { Construct } from "constructs";
import { StackExtender } from "../utils/StackExtender";
import { RemovalPolicy, SecretValue, StackProps } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  CachePolicy,
  Distribution,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3StaticWebsiteOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import {
  CompositePrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import {
  CodeBuildAction,
  GitHubSourceAction,
  S3DeployAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import {
  Cache,
  BuildSpec,
  LinuxBuildImage,
  LocalCacheMode,
  PipelineProject,
} from "aws-cdk-lib/aws-codebuild";

export class FrontendStack extends StackExtender {
  private distributionBucket: Bucket;
  private artifactBucket: Bucket;

  private sourceArtifact: Artifact;
  private codeBuildArtificat: Artifact;

  private hostedZone: HostedZone;
  private certificate: Certificate;
  private cloudfrontDistribution: Distribution;
  private pipelineRole: Role;

  constructor(scope: Construct, props?: StackProps) {
    super(scope, "FrontendStack", props);

    const oauthToken = SecretValue.secretsManager("github-token");

    this.hostedZone = new HostedZone(this, "HostedZone", {
      zoneName: this.domainName,
    });

    this.certificate = new Certificate(this, "Certificate", {
      domainName: this.domainName,
      subjectAlternativeNames: [`*.${this.domainName}`],
      validation: CertificateValidation.fromDns(this.hostedZone),
    });

    // Creating buckets, and distributions for Frontend application
    this.distributionBucket = new Bucket(this, "DistributionBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.artifactBucket = new Bucket(this, "ArtifactBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // create artifacts
    //
    this.sourceArtifact = new Artifact("SourceArtifact");
    this.codeBuildArtificat = new Artifact("codeBuildArtifact");

    this.cloudfrontDistribution = new Distribution(
      this,
      "CloudfrontDistribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: new S3StaticWebsiteOrigin(this.distributionBucket),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_DISABLED,
        },
        domainNames: [`www.${this.domainName}`, this.domainName],
        certificate: this.certificate,
      },
    );

    new ARecord(this, "ARecord", {
      zone: this.hostedZone,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(this.cloudfrontDistribution),
      ),
      recordName: `www.${this.domainName}`,
    });

    new ARecord(this, "RootARecord", {
      zone: this.hostedZone,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(this.cloudfrontDistribution),
      ),
      recordName: this.domainName,
    });

    // INFO: Creating pipeline to send github repo to bucket

    this.pipelineRole = new Role(this, "PipelineRole", {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal("codebuild.amazonaws.com"),
        new ServicePrincipal("codepipeline.amazonaws.com"),
      ),
      inlinePolicies: {
        CdkDeployPermissions: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["sts:AssumeRole"],
              resources: ["arn:aws:iam::*:role/cdk-*"],
            }),
          ],
        }),
      },
    });

    new Pipeline(this, "Pipeline", {
      artifactBucket: this.artifactBucket,
      pipelineName: "FrontendPipeline",
      role: this.pipelineRole,
      stages: [
        {
          stageName: "Source",
          actions: [
            new GitHubSourceAction({
              actionName: "Source",
              owner: "RizaHKhan",
              repo: "chat-frontend",
              branch: "master",
              oauthToken,
              output: this.sourceArtifact,
            }),
          ],
        },
        {
          stageName: "Build",
          actions: [
            new CodeBuildAction({
              actionName: "Build",
              project: new PipelineProject(this, "BuildProject", {
                environment: {
                  buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
                },
                buildSpec: BuildSpec.fromObject({
                  version: "0.2",
                  phases: {
                    install: {
                      "runtime-versions": { nodejs: 20 },
                      commands: ["npm install"],
                    },
                    build: {
                      commands: ["npm run build"],
                    },
                  },
                  artifacts: {
                    "base-directory": "dist",
                    files: ["**/*"],
                  },
                }),
                cache: Cache.local(LocalCacheMode.CUSTOM),
              }),
              input: this.sourceArtifact,
              outputs: [this.codeBuildArtificat],
            }),
          ],
        },
        {
          stageName: "Deploy",
          actions: [
            new S3DeployAction({
              actionName: "Deploy",
              input: this.codeBuildArtificat,
              bucket: this.distributionBucket, // Target bucket
              extract: true,
            }),
          ],
        },
      ],
    });
  }
}
