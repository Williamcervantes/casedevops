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

    //  Create a VPC
    const vpc = new ec2.Vpc(this, 'TestAppVPC', {
      maxAzs: 2, 
      natGateways: 1,
    });

    //  Create an ECS Cluster
    const cluster = new ecs.Cluster(this, 'TestAppCluster', { vpc });

    //  Create an ECR Repository for the Docker image
    const repository = new ecr.Repository(this, 'TestAppRepository');

    //  Define an IAM Role for ECS Tasks
    const taskRole = new iam.Role(this, 'TestAppTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    //  Define the ECS Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TestAppTask', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole: taskRole,
    });

    //  Create a CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, "TestAppLogGroup", {
      logGroupName: "/aws/ecs/CdkStack-TestAppContainer",
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically deletes logs when CDK stack is deleted
    });

    //  Create a Secret in AWS Secrets Manager
    const secret = new secretsmanager.Secret(this, 'TestAppSecret', {
      secretName: 'TestAppDatabaseCredentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          DATABASE_URL: 'postgres://user:password@db-host:5432/dbname', // Placeholder
          DJANGO_SECRET_KEY: 'your-secret-key-placeholder',
        }),
        generateStringKey: 'randomPassword', // Generates a secure password if needed
      },
    });

    const containerImage = ecs.ContainerImage.fromAsset("../path-to-your-dockerfile-folder"); 

    //  Add a Container to ECS Task
    const container = taskDefinition.addContainer('TestAppContainer', {
      containerName: "TestAppContainer",  //  Explicitly set container name
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "ecs",
        logGroup: logGroup,
      }),
      environment: {
        DJANGO_SETTINGS_MODULE: "testapp.settings.production",
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(secret, 'DATABASE_URL'),
        DJANGO_SECRET_KEY: ecs.Secret.fromSecretsManager(secret, 'DJANGO_SECRET_KEY'),
      },
    });

    //  Ensure the container exposes the correct port
    container.addPortMappings({
      containerPort: 8000,
    });

    //  Define ECS Service AFTER defining the container
    const service = new ecs.FargateService(this, 'TestAppService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
    });

    //  Define an Application Load Balancer (ALB)
    const lb = new elbv2.ApplicationLoadBalancer(this, 'TestAppLB', {
      vpc,
      internetFacing: true, // Keeps it public-facing
    });

    //  Create a Listener and Target Group
    const listener = lb.addListener('TestAppListener', { port: 80 });

    //  Attach ECS Service to ALB after defining the container correctly
    listener.addTargets("EcsTarget", {
      port: 8000,
      targets: [
        service.loadBalancerTarget({ containerName: "TestAppContainer", containerPort: 8000 }),
      ],
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });

    //  Output the Load Balancer DNS Name
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: lb.loadBalancerDnsName,
    });

    //  Enable Auto-Scaling for the ECS Service
    const scaling = service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 5 });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50, // Add containers if CPU usage exceeds 50%
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 60, // Add containers if Memory usage exceeds 60%
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    //  Allow ECS to read from Secrets Manager
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: [secret.secretArn], // Restrict access to only this secret
    }));
  }
}
