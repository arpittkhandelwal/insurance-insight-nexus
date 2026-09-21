FROM python:3.12-slim

# Create a non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Install dependencies
# We use --no-cache-dir to keep the image small
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and data
COPY . .

# Set ownership to non-root user
RUN chown -R appuser:appuser /app
USER appuser

# Expose the port ECS Fargate will use
EXPOSE 8080

# Run Uvicorn on 0.0.0.0:8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
