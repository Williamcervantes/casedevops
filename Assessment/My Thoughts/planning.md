In this file I will describe my current plan on how to complete this assessment and will update as I got through it

Exploration steps
-[x] Explore the contents of testapp looking for enviroment variables and anything I must take note going forward
    Obs: I found some sensitive information that must be set to enviroment variable
-[x] Run the application locally
    Obs: Application run ok
-[x] execute test.sh
    Obs: Test run, there is a single check that looks for a particular enviroment variable being != none. I will add this as mandatory check within CI/CD pipeline

Initial Development
-[X] Create a dockerfile and conteinerize the application
Obs: The application is now containerized and runs inside Docker.
Obs2: Had to set a database inside of django settings
-[X] Create a docker-compose.yml file (optional, but useful for testing).
Obs: a simple docker-compose was crated
-[X] Test the Docker container locally.
Obs: Ensured the container runs correctly, logs confirming successful startup.

Infrastructure Setup (AWS CDK)
-[ ] Initialize AWS CDK project.
Obs: Project initialized with TypeScript.
-[ ] Define VPC and security groups.
Obs: Networking components set up for security and isolation.
-[ ] Create an ECR repository for container images.

-[ ] Add an Application Load Balancer (ALB) for traffic routing.

-[ ] Configure an RDS PostgreSQL database (if needed).

-[ ] Store sensitive environment variables in AWS Secrets Manager.

-[ ] Deploy the infrastructure and validate.

CI/CD Pipeline (GitHub Actions)
-[ ] Create a .github/workflows/deploy.yml file.

-[ ] Set up GitHub Actions to build and push the Docker image to ECR.   

-[ ] Integrate infrastructure deployment via AWS CDK in the pipeline.

-[ ] Add an automated deployment step for ECS.

-[ ] Include a mandatory check for required environment variables in the pipeline.

-[ ] Run unit tests automatically before deployment.

Testing & Validation
-[ ] Validate ECS deployment and application accessibility via ALB.

-[ ] Check logs with aws logs tail to verify the container is running.

-[ ] Ensure application health check passes.

-[ ] Monitor CloudWatch logs and set up alerts.

-[ ] Test auto-scaling behavior under load.

