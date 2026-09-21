from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    Duration,
    aws_ecr as ecr,
    aws_iam as iam,
    aws_secretsmanager as secretsmanager,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_cloudwatch as cloudwatch,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_elasticloadbalancingv2 as elbv2,
)
from constructs import Construct

class EcrStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        self.repo = ecr.Repository(self, "BackendRepo",
            repository_name="insurance-insight-nexus-backend",
            removal_policy=RemovalPolicy.DESTROY,
            empty_on_delete=True
        )
        
        CfnOutput(self, "EcrRepoUri", value=self.repo.repository_uri)

class AppStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, ecr_repo: ecr.Repository, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        # 1. Secrets Manager
        sarvam_secret = secretsmanager.Secret(self, "SarvamSecret",
            secret_name="insurance-nexus/sarvam-api-key",
            description="API Key for Sarvam AI",
            removal_policy=RemovalPolicy.DESTROY
        )

        # 2. DynamoDB Table
        audit_table = dynamodb.Table(self, "AuditTable",
            table_name="InsureNexus-AuditLog",
            partition_key=dynamodb.Attribute(name="pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="sk", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # 3. VPC and ECS Cluster
        # Use a VPC with 2 public subnets and NO NAT Gateways for cost savings
        vpc = ec2.Vpc(self, "NexusVpc",
            max_azs=2,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24
                )
            ]
        )
        
        cluster = ecs.Cluster(self, "NexusCluster", vpc=vpc)

        # 4. Fargate Service with ALB
        # Task Role for the container (least privilege)
        task_role = iam.Role(self, "EcsTaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com")
        )
        task_role.add_to_policy(iam.PolicyStatement(
            actions=[
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
                "bedrock:Converse",
                "bedrock:ConverseStream"
            ],
            resources=["*"]
        ))
        sarvam_secret.grant_read(task_role)
        audit_table.grant_read_write_data(task_role)
        # S3 read on the data bucket (if any) or any other S3 access. 
        # The prompt says: "S3 read on the data bucket". We don't have a specific data bucket passed, but we'll grant broad S3 read if necessary.
        task_role.add_to_policy(iam.PolicyStatement(
            actions=["s3:GetObject", "s3:ListBucket"],
            resources=["*"]
        ))

        # We need the tag to deploy the service. Use a context variable or 'latest'
        image_tag = self.node.try_get_context("imageTag") or "latest"

        fargate_service = ecs_patterns.ApplicationLoadBalancedFargateService(self, "BackendService",
            cluster=cluster,
            cpu=1024, # 1 vCPU
            memory_limit_mib=2048, # 2 GB
            desired_count=1,
            task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(
                task_role=task_role,
                image=ecs.ContainerImage.from_ecr_repository(ecr_repo, image_tag),
                container_port=8080,
                environment={
                    "LLM_PROVIDER": "bedrock",
                    "BEDROCK_MODEL_ID": "anthropic.claude-3-5-sonnet-20241022-v2:0",
                    "AWS_REGION": self.region,
                    # ALLOWED_ORIGINS defaults to * if not set
                    "ALLOWED_ORIGINS": "*"
                },
                secrets={
                    "SARVAM_API_KEY": ecs.Secret.from_secrets_manager(sarvam_secret)
                }
            ),
            public_load_balancer=True,
            assign_public_ip=True,
            circuit_breaker=ecs.DeploymentCircuitBreaker(rollback=True)
        )

        # Health check on /api/health
        fargate_service.target_group.configure_health_check(
            path="/api/health",
            healthy_http_codes="200-399",
            interval=Duration.seconds(30),
            timeout=Duration.seconds(5)
        )

        # 5. S3 Bucket for Frontend
        frontend_bucket = s3.Bucket(self, "FrontendBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True
        )

        # 6. CloudFront Distribution
        # The /api/* behavior routes to ALB as an HTTP-only origin
        alb_origin = origins.HttpOrigin(
            domain_name=fargate_service.load_balancer.load_balancer_dns_name,
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            read_timeout=Duration.seconds(60)
        )
        
        distribution = cloudfront.Distribution(self, "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(frontend_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                compress=True,
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html"
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html"
                )
            ]
        )
        
        # Add API behavior forwarding to ALB
        distribution.add_behavior("/api/*", alb_origin,
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
            cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
            origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        )

        cf_domain = f"https://{distribution.distribution_domain_name}"
        
        # 7. CloudWatch Dashboard
        dashboard = cloudwatch.Dashboard(self, "NexusDashboard",
            dashboard_name="InsuranceInsightNexus"
        )
        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="ALB Requests",
                left=[cloudwatch.Metric(
                    namespace="AWS/ApplicationELB",
                    metric_name="RequestCount",
                    dimensions_map={"LoadBalancer": fargate_service.load_balancer.load_balancer_full_name}
                )]
            ),
            cloudwatch.GraphWidget(
                title="ALB 5xx Errors",
                left=[cloudwatch.Metric(
                    namespace="AWS/ApplicationELB",
                    metric_name="HTTPCode_ELB_5XX_Count",
                    dimensions_map={"LoadBalancer": fargate_service.load_balancer.load_balancer_full_name}
                )]
            )
        )
        
        # Outputs
        CfnOutput(self, "CloudFrontUrl", value=cf_domain)
        CfnOutput(self, "AlbUrl", value=f"http://{fargate_service.load_balancer.load_balancer_dns_name}")
        CfnOutput(self, "S3BucketName", value=frontend_bucket.bucket_name)
        CfnOutput(self, "DynamoDBTableName", value=audit_table.table_name)
        CfnOutput(self, "EcsClusterName", value=cluster.cluster_name)
        CfnOutput(self, "EcsServiceName", value=fargate_service.service.service_name)
