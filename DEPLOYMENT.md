# Deploying GolFrame to AWS

This is the step-by-step for taking the app from local-only to a live site on AWS: S3 for
video/thumbnail/keypoints storage, RDS Postgres for the database, and **Amazon ECS Express Mode**
for compute, all in one AWS account.

> **Why ECS Express Mode and not App Runner?** App Runner stopped accepting new customers on
> April 30, 2026. AWS's own recommended replacement is ECS Express Mode — a newer feature inside
> ECS that specifically preserves App Runner's "push a container, get a load-balanced HTTPS URL"
> simplicity, just built on the same underlying Fargate compute (still a real always-on process,
> so the app's background-thread processing pattern works exactly the same as it did in the
> original App Runner plan — no app code changes were needed for this switch, only deployment
> config).

Deploys happen via a GitHub Actions workflow (already added at `.github/workflows/deploy.yml`):
every push to `main` builds the Docker image, pushes it to ECR, and updates the ECS Express
service. This replaces App Runner's "connect a GitHub repo and it builds for you" — Express Mode
deploys from a container image rather than building from your repo directly, so GitHub Actions is
what does that building.

## 0. Prerequisites

- An AWS account, with the [AWS CLI](https://aws.amazon.com/cli/) installed and configured
  (`aws configure`) — most of the one-time IAM setup below is easiest via CLI commands you can just
  copy-paste.
- This repo is already pushed to [ajcachiaras/golFrame](https://github.com/ajcachiaras/golFrame).
- Your Roboflow API key (the one already in use locally).
- Pick one AWS region and use it everywhere below — this doc uses `us-east-1` as the example.

## 1. Create the S3 bucket

1. AWS Console → **S3** → **Create bucket**.
2. Name it something globally unique, e.g. `golframe-<yourname>-videos`.
3. Leave "Block all public access" **on** (checked). Nothing needs to be public — the app serves
   files via short-lived presigned URLs, not direct bucket access.
4. Everything else can stay default. Create the bucket.

## 2. Create the RDS Postgres database

1. AWS Console → **RDS** → **Create database**.
2. Engine: **PostgreSQL**. Templates: **Free tier** (if this is a new-ish AWS account, this gets you
   a `db.t4g.micro`/`db.t3.micro` instance free for 12 months).
3. Set a DB instance identifier (e.g. `golframe-db`), a master username, and a strong master
   password — **save this password**, you'll need it for the connection string.
4. Under **Connectivity**: "Public access" — see the networking note in step 4 before deciding.
   Simplest path: **Yes**. Locked-down path: **No** + custom security group (step 4).
5. Create the database. It takes a few minutes to become "Available". Once it is, note the
   **endpoint** (a hostname) and **port** (5432).
6. Your `DATABASE_URL` (used in step 6) will be:
   `postgresql://<master-username>:<master-password>@<endpoint>:5432/postgres`

## 3. Create the IAM roles

ECS Express Mode uses three separate roles, plus a fourth for GitHub Actions itself to be able to
deploy. Run these with the AWS CLI (swap in your account ID, bucket name, and region).

**a) Task execution role** (standard ECS role — lets the ECS agent pull the image from ECR and
write logs; nothing app-specific):
```bash
aws iam create-role --role-name golframe-ecs-execution-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name golframe-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

**b) Infrastructure role** (Express-Mode-specific — lets ECS provision the load balancer, security
groups, SSL cert, and autoscaling on your behalf):
```bash
aws iam create-role --role-name golframe-ecs-infrastructure-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name golframe-ecs-infrastructure-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonECSInfrastructureRoleforExpressGatewayServices
```

**c) Task role** (this is the app-specific one — what `blob.py` actually runs as, giving it S3
access with no access keys anywhere):
```bash
aws iam create-role --role-name golframe-task-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

cat > /tmp/golframe-s3-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::golframe-yourname-videos",
        "arn:aws:s3:::golframe-yourname-videos/*"
      ]
    }
  ]
}
EOF
aws iam put-role-policy --role-name golframe-task-role \
  --policy-name golframe-s3-access --policy-document file:///tmp/golframe-s3-policy.json
```

**d) GitHub Actions deploy role** (lets the GitHub Actions workflow push to ECR and update the ECS
service — no long-lived AWS keys stored as GitHub secrets, it authenticates via OpenID Connect):

First, register GitHub as an OIDC identity provider (skip this if your account already has one —
check IAM → Identity providers first):
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Then create the role (replace `<ACCOUNT_ID>` with your actual AWS account ID):
```bash
cat > /tmp/golframe-gha-trust.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"},
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"},
        "StringLike": {"token.actions.githubusercontent.com:sub": "repo:ajcachiaras/golFrame:ref:refs/heads/main"}
      }
    }
  ]
}
EOF
aws iam create-role --role-name golframe-github-actions-role \
  --assume-role-policy-document file:///tmp/golframe-gha-trust.json

cat > /tmp/golframe-gha-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*"},
    {
      "Effect": "Allow",
      "Action": ["ecr:BatchCheckLayerAvailability", "ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:BatchGetImage"],
      "Resource": "arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/golframe"
    },
    {
      "Effect": "Allow",
      "Action": ["ecs:CreateCluster", "ecs:RegisterTaskDefinition", "ecs:CreateExpressGatewayService", "ecs:UpdateExpressGatewayService", "ecs:DescribeExpressGatewayService", "ecs:DescribeClusters", "ecs:DescribeServices", "ecs:ListServiceDeployments", "ecs:DescribeServiceDeployments", "ecs:TagResource", "ecs:UntagResource"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::<ACCOUNT_ID>:role/golframe-ecs-execution-role",
        "arn:aws:iam::<ACCOUNT_ID>:role/golframe-ecs-infrastructure-role",
        "arn:aws:iam::<ACCOUNT_ID>:role/golframe-task-role"
      ]
    }
  ]
}
EOF
aws iam put-role-policy --role-name golframe-github-actions-role \
  --policy-name golframe-deploy-access --policy-document file:///tmp/golframe-gha-policy.json
```

Note the ARN printed for `golframe-github-actions-role` — you'll paste it into the GitHub Actions
workflow file in step 6.

## 4. Networking note (RDS reachability)

By default, an Express Mode service runs in your account's default VPC and a public subnet. Two
options, same tradeoff as any AWS setup like this:

- **Simple**: RDS publicly accessible (step 2) → add an inbound rule on the RDS security group
  allowing port 5432 from `0.0.0.0/0`. Combined with a strong DB password, a reasonable tradeoff for
  a personal project.
- **Locked down**: keep RDS private, and pass `subnets`/`security-groups` inputs to the deploy
  action (step 6) pointing at the same VPC as RDS, with a security group that allows reaching RDS on
  5432. A bit more setup, no public DB exposure.

## 5. Create the ECR repository

```bash
aws ecr create-repository --repository-name golframe --region us-east-1
```

## 6. Set up the GitHub Actions workflow

The workflow file is already in the repo at `.github/workflows/deploy.yml`. You need to:

1. Edit it and fill in the four placeholders at the top (`AWS_REGION`, `AWS_ACCOUNT_ID`, and the two
   role ARNs aren't placeholders — they're read from GitHub secrets, see next step — but double
   check the `region`/`cluster`/`service-name` values match what you used above).
2. In the GitHub repo → **Settings → Secrets and variables → Actions**, add these repository
   secrets:
   - `AWS_DEPLOY_ROLE_ARN` — the `golframe-github-actions-role` ARN from step 3d
   - `AWS_EXECUTION_ROLE_ARN` — the `golframe-ecs-execution-role` ARN from step 3a
   - `AWS_INFRASTRUCTURE_ROLE_ARN` — the `golframe-ecs-infrastructure-role` ARN from step 3b
   - `AWS_TASK_ROLE_ARN` — the `golframe-task-role` ARN from step 3c
   - `ROBOFLOW_API_KEY` — your existing key
   - `DATABASE_URL` — the connection string from step 2
   - `S3_BUCKET_NAME` — your bucket name from step 1
   - `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` — pick a real username/password; this is the only thing
     standing between the public internet and your swing library.
3. Commit and push to `main`. The workflow runs automatically, builds the image, pushes it to ECR,
   and creates the Express service on its first run (updates it on every run after that).
4. Watch the run under the repo's **Actions** tab. The last step's output includes the service's
   public endpoint URL once it succeeds.

## 7. First real check

Once deployed: open the endpoint URL from the Actions log, log in with the Basic Auth credentials
from step 6, and upload a real swing clip. If something goes wrong, check the GitHub Actions run
log first (build/push failures show up there), then the ECS service's **Logs** tab in the AWS
Console (CloudWatch) for anything that fails after the container starts — that's the same
stdout/stderr you'd see running `uvicorn` locally.

Since ECS Express Mode is a very new AWS feature (introduced in early 2026), some console/CLI
details here might shift slightly from what's documented above — share whatever error you hit and
I'll help work through it.
