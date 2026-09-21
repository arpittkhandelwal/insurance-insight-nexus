#!/usr/bin/env python3
import os
import aws_cdk as cdk
from infra.infra_stack import EcrStack, AppStack

app = cdk.App()
env = cdk.Environment(
    account=os.getenv('CDK_DEFAULT_ACCOUNT'),
    region=os.getenv('CDK_DEFAULT_REGION')
)

ecr_stack = EcrStack(app, "InsuranceInsightEcrStack", env=env)
app_stack = AppStack(app, "InsuranceInsightAppStack", ecr_repo=ecr_stack.repo, env=env)

app.synth()
