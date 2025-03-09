import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';

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

    // Create an ECR Repository for the Docker image
    const repository = new ecr.Repository(this, 'TestAppRepository');

    // Define an IAM Role for ECS Tasks
    const taskRole = new iam.Role(this, 'TestAppTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Retrieve secrets from AWS Secrets Manager
    const secret = secretsmanager.Secret.fromSecretNameV2(this, 'TestAppSecret', 'TestAppSecrets');

    // Define the ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TestAppTask', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole: taskRole,
    });

    // Add a Container to ECS Task
    const container = taskDefinition.addContainer('TestAppContainer', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'TestApp' }),
      environment: {
        DJANGO_SETTINGS_MODULE: 'testapp.settings.production',
      },
      secrets: {
        DJANGO_SECRET_KEY: ecs.Secret.fromSecretsManager(secret, 'DJANGO_SECRET_KEY'),
        DJANGO_DEBUG: ecs.Secret.fromSecretsManager(secret, 'DJANGO_DEBUG'),
        DJANGO_ALLOWED_HOSTS: ecs.Secret.fromSecretsManager(secret, 'DJANGO_ALLOWED_HOSTS'),
      },
    });

    container.addPortMappings({
      containerPort: 8000,
    });

    // Create an ECS Fargate Service
    const service = new ecs.FargateService(this, 'TestAppService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
    });

    // Create an Application Load Balancer (ALB)
    const lb = new elbv2.ApplicationLoadBalancer(this, 'TestAppLB', {
      vpc,
      internetFacing: true,
    });

    // Create a Listener and Target Group
    const listener = lb.addListener('TestAppListener', { port: 80 });

    listener.addTargets('TestAppTarget', {
      port: 8000,
      targets: [service],
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
      },
    });

    // Enable Auto-Scaling for the ECS Service
    const scaling = service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 5 });

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

    // Output the Load Balancer DNS Name
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: lb.loadBalancerDnsName,
    });
  }
}
