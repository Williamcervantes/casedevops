import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'TestAppVPC', {
      maxAzs: 2, 
      natGateways: 1,
    });

    // Create an ECS Cluster
    const cluster = new ecs.Cluster(this, 'TestAppCluster', { vpc });

    // Define ECR Repository Name
    const repoName = 'cdk-hnb659fds-container-assets-863518431049-sa-east-1';
    const repository = ecr.Repository.fromRepositoryName(this, 'TestAppRepository', repoName);

    // Get the latest image tag from environment variable
    const latestImageTag = process.env.ECR_LATEST_TAG || 'latest';

    // Create an IAM Role for ECS Task Execution
    const executionRole = new iam.Role(this, 'EcsExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });

    // Create an IAM Role for ECS Tasks
    const taskRole = new iam.Role(this, 'TestAppTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Attach Secrets Manager Permissions to ECS Task Role
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:sa-east-1:${this.account}:secret:TestAppSecrets*`],
    }));

    // Retrieve secrets from AWS Secrets Manager correctly
    const secret = secretsmanager.Secret.fromSecretAttributes(this, 'TestAppSecret', {
      secretCompleteArn: `arn:aws:secretsmanager:sa-east-1:${this.account}:secret:TestAppSecrets`,
    });

    // Define the ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TestAppTask', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole: taskRole,
    });

    // Create a CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'TestAppLogGroup', {
      logGroupName: '/aws/ecs/TestAppLogs',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add a Container to ECS Task
    const container = taskDefinition.addContainer('TestAppContainer', {
      image: ecs.ContainerImage.fromRegistry(
        `public.ecr.aws/${this.account}.dkr.ecr.sa-east-1.amazonaws.com/${repoName}:${latestImageTag}`
      ),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'TestApp',
        logGroup: logGroup,
      }),
      environment: {
        DJANGO_SETTINGS_MODULE: 'testapp.settings',
        DJANGO_DEBUG: process.env.DJANGO_DEBUG || 'False',
      },
      secrets: {
        DJANGO_SECRET_KEY: ecs.Secret.fromSecretsManager(secret, 'DJANGO_SECRET_KEY'),
      },
    });

    // Map container port
    container.addPortMappings({
      containerPort: 8000,
    });

    // Create an ECS Fargate Service with Load Balancer
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'DjangoService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      publicLoadBalancer: true,
      listenerPort: 80,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Set Allowed Hosts to ALB
    const albDnsName = fargateService.loadBalancer.loadBalancerDnsName;
    container.addEnvironment('DJANGO_ALLOWED_HOSTS', albDnsName);

    // Enable Auto-Scaling for the ECS Service
    const scaling = fargateService.service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 5 });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: albDnsName });
  }
}