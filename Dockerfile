# Stage 1: build the frontend static assets
FROM node:20-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend + the built frontend, served by the same process
FROM python:3.12-slim
WORKDIR /app/backend

# opencv-python needs these on a minimal Debian base (otherwise it fails to
# import with "libGL.so.1: cannot open shared object file"); libpq5 is the
# runtime client library psycopg2 needs to talk to RDS Postgres.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
# Mirrors the same backend/../frontend/dist relative layout main.py expects locally.
COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

# Pre-download the pose model weights into the image so a fresh container
# doesn't eat a cold-start delay downloading them on the first real request.
RUN python -c "from app.pose import get_pose_model; get_pose_model()"

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
