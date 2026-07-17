# Deploying GolFrame to AWS

This is the step-by-step for taking the app from local-only to a live site on AWS: S3 for
video/thumbnail/keypoints storage, RDS Postgres for the database, and **Amazon ECS Express Mode**
for compute, all in one AWS account. Everything below is done through the AWS Console — no AWS CLI
needed.

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
what does that building (on GitHub's own servers — nothing needs to build on your machine either).

## 0. Prerequisites

- An AWS account.
- This repo is already pushed to [ajcachiaras/golFrame](https://github.com/ajcachiaras/golFrame).
- Your Roboflow API key (the one already in use locally).
- Pick one AWS region and use it everywhere below (top-right region switcher in the console) — this
  project uses `us-west-1`.
- Your **AWS account ID** (12 digits) — shown top-right in the console under your account name, or
  on the IAM dashboard's summary. You'll paste this into a couple of JSON snippets below.

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
deploy. All four follow the same console pattern: create a permissions policy first (if it's a
custom one, not an AWS-provided one), then create the role and attach it.

### a) Task execution role
Standard ECS role — lets the ECS agent pull the image from ECR and write logs; nothing
app-specific, no custom policy needed.

1. **IAM → Roles → Create role**.
2. Trusted entity type: **Custom trust policy**. Paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {"Effect": "Allow", "Principal": {"Service": "ecs-tasks.amazonaws.com"}, "Action": "sts:AssumeRole"}
     ]
   }
   ```
3. **Next** → in the permissions search box type `AmazonECSTaskExecutionRolePolicy` → check it →
   **Next**.
4. Role name: `golframe-ecs-execution-role` → **Create role**.
5. Click into the role and copy its **ARN** (top of the page) — you'll need it in step 6.

### b) Infrastructure role
Express-Mode-specific — lets ECS provision the load balancer, security groups, SSL cert, and
autoscaling on your behalf.

1. **IAM → Roles → Create role** → Trusted entity type: **Custom trust policy**. Paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {"Effect": "Allow", "Principal": {"Service": "ecs.amazonaws.com"}, "Action": "sts:AssumeRole"}
     ]
   }
   ```
2. **Next** → search for `AmazonECSInfrastructureRoleforExpressGatewayServices` → check it →
   **Next**.
3. Role name: `golframe-ecs-infrastructure-role` → **Create role**. Copy its **ARN**.

### c) Task role (app-specific — S3 access)
This is what `blob.py` actually runs as, giving it S3 access with no access keys anywhere.

1. First create the permissions policy: **IAM → Policies → Create policy** → **JSON** tab → paste
   (swap in your actual bucket name):
   ```json
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
   ```
   Name it `golframe-s3-access` → **Create policy**.
2. **IAM → Roles → Create role** → Trusted entity type: **Custom trust policy**. Paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {"Effect": "Allow", "Principal": {"Service": "ecs-tasks.amazonaws.com"}, "Action": "sts:AssumeRole"}
     ]
   }
   ```
3. **Next** → search for `golframe-s3-access` (the policy you just made) → check it → **Next**.
4. Role name: `golframe-task-role` → **Create role**. Copy its **ARN**.

### d) GitHub Actions deploy role
Lets the GitHub Actions workflow push to ECR and update the ECS service — no long-lived AWS keys
stored as GitHub secrets, it authenticates via OpenID Connect (OIDC) instead.

**First, register GitHub as an identity provider** (skip if your account already has one — check
**IAM → Identity providers** first):
1. **IAM → Identity providers → Add provider**.
2. Provider type: **OpenID Connect**.
3. Provider URL: `https://token.actions.githubusercontent.com` → click **Get thumbprint**.
4. Audience: `sts.amazonaws.com`.
5. **Add provider**.

**Then create the deploy permissions policy**: **IAM → Policies → Create policy** → **JSON** tab
→ paste (replace `<REGION>` and `<ACCOUNT_ID>` with your actual values):
```json
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
```
Name it `golframe-deploy-access` → **Create policy**.

**Then create the role**: **IAM → Roles → Create role** → Trusted entity type: **Custom trust
policy** (this gives full control over the repo/branch restriction below, which the "Web identity"
wizard option doesn't expose directly). Paste (replace `<ACCOUNT_ID>`):
```json
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
```
**Next** → search for `golframe-deploy-access` → check it → **Next** → name it
`golframe-github-actions-role` → **Create role**. Copy its **ARN** — you'll paste it into GitHub
in step 6.

## 4. Networking note (RDS reachability)

By default, an Express Mode service runs in your account's default VPC and a public subnet. Two
options, same tradeoff as any AWS setup like this:

- **Simple**: RDS publicly accessible (step 2) → in the RDS console, click into the instance's
  security group → **Edit inbound rules** → add a rule allowing port 5432 from `0.0.0.0/0`.
  Combined with a strong DB password, a reasonable tradeoff for a personal project.
- **Locked down**: keep RDS private, and pass `subnets`/`security-groups` inputs to the deploy
  action (step 6) pointing at the same VPC as RDS, with a security group that allows reaching RDS on
  5432. A bit more setup, no public DB exposure.

## 5. Create the ECR repository

1. **AWS Console → ECR → Repositories → Create repository**.
2. Visibility: **Private**. Name: `golframe`.
3. Everything else default → **Create repository**.

## 6. Create the ECS cluster

The deploy action creates/updates the Express *service* on each run, but expects the *cluster* to
already exist — it won't create one for you.

> **First time using ECS in this account?** Cluster creation can fail with `Unable to assume the
> service linked role. Please verify that the ECS service linked role exists.` ECS needs the
> `AWSServiceRoleForECS` service-linked role to exist before it can create anything, and that role
> is normally auto-created on first use but occasionally doesn't fire. If you hit this, open
> **CloudShell** (the `>_` icon in the AWS Console's top nav — a browser terminal with the AWS CLI
> already authenticated, no local install needed) and run:
> ```
> aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
> ```
> then retry cluster creation below. The same fix applies if you later see this error for
> `elasticloadbalancing.amazonaws.com` or `ecs.application-autoscaling.amazonaws.com` during the
> Express service deploy — just swap the service name in the command.

1. **AWS Console → ECS → Clusters → Create cluster**.
2. Cluster name: `golframe` (must match exactly — this is what the workflow's `ECS_CLUSTER` env var
   passes in).
3. Infrastructure: **AWS Fargate (serverless)** — no EC2 instances needed.
4. Everything else default → **Create**. An empty Fargate cluster costs nothing until tasks
   actually run in it.

## 7. Set up the GitHub Actions workflow

The workflow file is already in the repo at `.github/workflows/deploy.yml` and doesn't need any
edits — the region/cluster/service names in it already match this doc. You just need to add
secrets so it has something to deploy with:

In the GitHub repo → **Settings → Secrets and variables → Actions**, add these repository secrets:
- `AWS_DEPLOY_ROLE_ARN` — the `golframe-github-actions-role` ARN from step 3d
- `AWS_EXECUTION_ROLE_ARN` — the `golframe-ecs-execution-role` ARN from step 3a
- `AWS_INFRASTRUCTURE_ROLE_ARN` — the `golframe-ecs-infrastructure-role` ARN from step 3b
- `AWS_TASK_ROLE_ARN` — the `golframe-task-role` ARN from step 3c
- `ROBOFLOW_API_KEY` — your existing key
- `DATABASE_URL` — the connection string from step 2
- `S3_BUCKET_NAME` — your bucket name from step 1
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` — pick a real username/password; this is the only thing
  standing between the public internet and your swing library.

Then either push any commit to `main`, or go to the repo's **Actions** tab → select the "Deploy to
ECS Express Mode" workflow → **Run workflow** to trigger it manually the first time. It builds the
image, pushes it to ECR, and creates the Express service on its first run (updates it on every run
after that). Watch the run under the **Actions** tab — the last step's output includes the
service's public endpoint URL once it succeeds.

## 8. First real check

Once deployed: open the endpoint URL from the Actions log, log in with the Basic Auth credentials
from step 7, and upload a real swing clip. If something goes wrong, check the GitHub Actions run
log first (build/push failures show up there), then the ECS service's **Logs** tab in the AWS
Console (CloudWatch) for anything that fails after the container starts — that's the same
stdout/stderr you'd see running `uvicorn` locally.

Since ECS Express Mode is a very new AWS feature (introduced in early 2026), some console details
here might shift slightly from what's documented above — share whatever error/screen you hit and
I'll help work through it.
