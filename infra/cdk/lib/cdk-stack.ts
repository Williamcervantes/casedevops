import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'TestAppVPC', {
      maxAzs: 3, 
    });

    // Create an ECS Cluster
    const cluster = new ecs.Cluster(this, 'TestAppCluster', { vpc });

    // Define Log Group for ECS
    const logGroup = new logs.LogGroup(this, 'TestAppLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // Define ECR Repository Name
    const repository = ecr.Repository.fromRepositoryName(this, 'TestAppRepository', 'django-app');

    const latestImageTag = process.env.ECR_LATEST_TAG || 'latest';
    const djangoContainerImage = ecs.ContainerImage.fromEcrRepository(
      repository,
      latestImageTag
    );

    // Retrieve secrets from AWS Secrets Manager
    const secret = secretsmanager.Secret.fromSecretAttributes(this, 'TestAppSecret', {
      secretCompleteArn: `arn:aws:secretsmanager:sa-east-1:${this.account}:secret:TestAppSecrets`,
    });

    // Define Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TestAppTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
    });

    // Define IAM Role for ECS Tasks
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

    // Define Django Container
    const djangoContainer = taskDefinition.addContainer('TestAppContainer', {
      image: djangoContainerImage,
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: 'django',
      }),
      environment: {
        DJANGO_SETTINGS_MODULE: 'testapp.settings',
      },
      secrets: {
        DJANGO_SECRET_KEY: ecs.Secret.fromSecretsManager(secret, 'DJANGO_SECRET_KEY'),
      },
    });

    djangoContainer.addPortMappings({
      containerPort: 8000,
    });

    // Create Load Balancer
    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'TestAppLoadBalancer', {
      vpc,
      internetFacing: true,
    });

    // Define Listener
    const listener = loadBalancer.addListener('Listener', {
      port: 80,
    });

    // Create ECS Service
    const ecsService = new ecs.FargateService(this, 'TestAppService', {
      cluster,
      taskDefinition,
      desiredCount: 2,
    });

    // Attach ECS Service to Load Balancer
    listener.addTargets('TestAppTargets', {
      port: 80,
      targets: [ecsService],
    });

    // Allow traffic from Load Balancer to ECS Service
    ecsService.connections.allowFrom(loadBalancer, ec2.Port.tcp(80));

    // Enable Auto Scaling
    const scaling = ecsService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

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
  }
}