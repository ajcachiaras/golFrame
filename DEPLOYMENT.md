# Deploying GolFrame to AWS

This is the step-by-step for taking the app from local-only to a live site on AWS: S3 for
video/thumbnail/keypoints storage, RDS Postgres for the database, App Runner for compute, all in
one AWS account. Everything below is a one-time setup; after that, pushing new commits to your repo
triggers a new App Runner deploy automatically (if you connect it to GitHub) or you re-push a new
image (if you go the ECR route).

## 0. Prerequisites

- An AWS account.
- This directory isn't a git repo yet — you'll need to `git init`, commit, and push it to a GitHub
  repo before App Runner can build from it (App Runner can build directly from a connected GitHub
  repo — simplest path — **or** you can push a Docker image to ECR instead if you'd rather use the
  AWS CLI; this doc assumes the GitHub path). Just say the word and I can do the `git init` +
  first commit for you — I only touch git when asked.
- Your Roboflow API key (the one already in use locally).

## 1. Create the S3 bucket

1. AWS Console → **S3** → **Create bucket**.
2. Name it something globally unique, e.g. `golframe-<yourname>-videos`. Any region works; pick one
   close to you (e.g. `us-east-1`) — you'll reuse this region everywhere else below.
3. Leave "Block all public access" **on** (checked). Nothing needs to be public — the app serves
   files via short-lived presigned URLs, not direct bucket access.
4. Everything else can stay default. Create the bucket.

## 2. Create the RDS Postgres database

1. AWS Console → **RDS** → **Create database**.
2. Engine: **PostgreSQL**. Templates: **Free tier** (if this is a new-ish AWS account, this gets you
   a `db.t4g.micro`/`db.t3.micro` instance free for 12 months).
3. Set a DB instance identifier (e.g. `golframe-db`), a master username, and a strong master
   password — **save this password**, you'll need it for the connection string.
4. Under **Connectivity**: note whether you want "Public access" Yes or No — see the networking note
   in step 4 below before deciding. For the simplest path (fewer moving parts, fine for a low-value
   personal DB with a strong password), choose **Yes**. For the more locked-down path, choose **No**
   and use a VPC connector (step 4).
5. Create the database. It takes a few minutes to become "Available". Once it is, click into it and
   note the **endpoint** (a hostname) and **port** (5432).
6. Your connection string for the `DATABASE_URL` env var (step 5) will be:
   `postgresql://<master-username>:<master-password>@<endpoint>:5432/postgres`

## 3. Create an IAM policy + role for S3 access

1. AWS Console → **IAM** → **Policies** → **Create policy** → JSON tab. Paste (swap in your actual
   bucket name):
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
2. Name it e.g. `golframe-s3-access`, create it.
3. **IAM** → **Roles** → **Create role** → Trusted entity: **AWS service** → use case
   **App Runner** (under "Use cases for other AWS services" if it's not in the short list — search
   "App Runner"). Attach the `golframe-s3-access` policy you just made. Name the role e.g.
   `golframe-app-runner-role`. This is the *instance role* App Runner will run as — no access keys
   needed anywhere.

## 4. Networking note (RDS reachability)

App Runner services run **outside your VPC** by default, so they can't reach a private RDS
instance out of the box. Two options:

- **Simple**: made RDS publicly accessible in step 2 → in the RDS instance's security group, add an
  inbound rule allowing port 5432 from `0.0.0.0/0` (or tighter if you know App Runner's egress IP
  range for your region, but that's more upkeep than it's worth here). Combined with a strong DB
  password this is a reasonable tradeoff for a personal project.
- **Locked down**: keep RDS private, and in App Runner's service configuration add a **VPC
  connector** (Networking section) pointing at the VPC/subnets RDS lives in, with a security group
  that allows the connector to reach RDS on 5432. A bit more setup, no public DB exposure.

## 5. Create the App Runner service

1. AWS Console → **App Runner** → **Create service**.
2. Source: **Source code repository** → connect your GitHub account → pick this repo/branch.
   Deployment trigger: **Automatic** (so future pushes redeploy automatically).
3. Build settings: **Use a configuration file** — App Runner will detect the `Dockerfile` at the repo
   root automatically. Port: `8000`.
4. Instance role: pick `golframe-app-runner-role` from step 3 (this is what lets the running
   container call S3 without any access keys).
5. Environment variables (Configure service → Environment variables):
   - `ROBOFLOW_API_KEY` — your existing key
   - `DATABASE_URL` — the connection string from step 2
   - `S3_BUCKET_NAME` — your bucket name from step 1
   - `AWS_REGION` — the region you used throughout (e.g. `us-east-1`)
   - `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` — pick a username/password; this is the only thing
     standing between the public internet and your swing library, so use a real password, not
     something guessable.
6. Health check: path `/api/health`, everything else can stay default.
7. If you went with the VPC-connector networking option, attach it under Networking now.
8. Create & deploy. First build takes a few minutes (it's building the frontend, installing Python
   deps, and pre-downloading the pose model — see the Dockerfile). App Runner gives you a
   `https://xxxx.awsapprunner.com` URL once it's live.

## 6. First real check

Once deployed: open the App Runner URL, log in with the Basic Auth credentials from step 5, and
upload a real swing clip. If something goes wrong, App Runner's **Logs** tab (under the service)
shows the same stdout/stderr you'd see running `uvicorn` locally — that's the first place to look.

Share any error you hit and I can help read through it.
